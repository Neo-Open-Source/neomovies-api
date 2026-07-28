import { Elysia, t } from "elysia"
import { config } from "../config"
import { success, badRequest, notFound } from "../lib/response"
import { getPlayerData, resolveCdnId } from "../services/cdn"

export const playerRoutes = new Elysia()

  .get("/api/v1/player/alloha/tmdb/:tmdbId", async ({ params: { tmdbId }, query }) => {
    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    let url = `https://api.alloha.tv/?token=${config.alloha.token}&tmdb=${tmdbId}`
    if (season) url += `&season=${season}`
    if (episode) url += `&episode=${episode}`

    return success({ provider: "Alloha", url, type: "iframe" })
  }, { params: t.Object({ tmdbId: t.Numeric() }) })

  .get("/api/v1/player/alloha/kp/:kpId", async ({ params: { kpId }, query }) => {
    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    let url = `https://api.alloha.tv/?token=${config.alloha.token}&kp=${kpId}`
    if (season) url += `&season=${season}`
    if (episode) url += `&episode=${episode}`

    return success({ provider: "Alloha", url, type: "iframe" })
  }, { params: t.Object({ kpId: t.Numeric() }) })

  .get("/api/v1/player/collaps/kp/:kpId", async ({ params: { kpId }, query }) => {
    if (!config.collaps.host || !config.collaps.token) return badRequest("Collaps not configured")

    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    const listUrl = `${config.collaps.host.replace(/\/$/, "")}/list?token=${config.collaps.token}&kinopoisk_id=${kpId}`
    const res = await fetch(listUrl)
    if (!res.ok) return badRequest("Video not found on Collaps")

    const data = await res.json() as any
    const result = data?.results?.[0]
    if (!result) return badRequest("No results from Collaps")

    let iframeUrl: string | null = null

    if (result.type === "series") {
      const seasons = result.seasons ?? []
      if (season != null && episode != null) {
        const s = seasons.find((s: any) => s.season === season)
        iframeUrl = s?.episodes?.find((e: any) => {
          const en = typeof e.episode === "string" ? parseInt(e.episode) : e.episode
          return en === episode
        })?.iframe_url ?? null
      } else if (season != null) {
        const s = seasons.find((s: any) => s.season === season)
        iframeUrl = s?.episodes?.[0]?.iframe_url ?? null
      } else {
        iframeUrl = result.iframe_url ?? seasons[0]?.episodes?.[0]?.iframe_url ?? null
      }
    } else {
      iframeUrl = result.iframe_url ?? null
    }

    if (!iframeUrl) return badRequest("No iframe URL found")

    return success({ provider: "Collaps", url: iframeUrl, type: "iframe" })
  }, { params: t.Object({ kpId: t.Numeric() }) })

  .get("/api/v1/player/cdn/:cdnId", async ({ params: { cdnId }, query }) => {
    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    try {
      const data = await getPlayerData(cdnId, season, episode)
      return success({ provider: "CDN", ...data, type: "hls" })
    } catch (e: any) {
      const msg = (e as Error).message
      if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
        return notFound("video not found")
      }
      throw e
    }
  }, { params: t.Object({ cdnId: t.Numeric() }) })

  .get("/api/v1/player/cdn/imdb/:imdbId", async ({ params: { imdbId }, query }) => {
    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    let cdnId: number
    try {
      cdnId = await resolveCdnId(imdbId)
    } catch {
      return notFound("video not found")
    }

    try {
      const data = await getPlayerData(cdnId, season, episode)
      return success({ provider: "CDN", ...data, type: "hls" })
    } catch (e: any) {
      const msg = (e as Error).message
      if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
        return notFound("video not found")
      }
      throw e
    }
  }, { params: t.Object({ imdbId: t.String() }) })

  .get("/api/v1/player/hls/proxy", async ({ query, request }) => {
    const { url } = query as { url?: string }
    if (!url) return badRequest("Missing url parameter")

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) return badRequest("Failed to fetch HLS stream")

    const contentType = res.headers.get("content-type") || ""
    const text = await res.text()

    if (!contentType.includes("mpegurl") && !text.startsWith("#EXTM3U")) {
      return new Response(await res.arrayBuffer(), {
        headers: { "Content-Type": contentType || "video/MP2T", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=604800" },
      })
    }

    const baseUrl = new URL(url)
    const proxyBase = `${request.url.split("?")[0]}?url=`

    const rewritten = text.split("\n").map(line => {
      const t = line.trim()
      if (!t || t.startsWith("#") || t.startsWith("http")) return line
      if (t.startsWith("//")) return line
      const absolute = new URL(t, baseUrl.origin + baseUrl.pathname).href
      return `${proxyBase}${encodeURIComponent(absolute)}`
    }).join("\n")

    return new Response(rewritten, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" },
    })
  })
