import { Elysia, t } from "elysia"
import { config } from "../config"
import { success } from "../lib/response"
import { NotFoundError, BadRequestError } from "../lib/errors"
import { getPlayerData, resolveCdnId } from "../services/cdn"

export const playerRoutes = new Elysia()

  .get("/api/v1/player/alloha/tmdb/:tmdbId", async ({ params: { tmdbId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    const proxyParams = new URLSearchParams({ tmdb: String(tmdbId) })
    if (season) proxyParams.set("season", String(season))
    if (episode) proxyParams.set("episode", String(episode))

    return success({
      provider: "Alloha",
      url: `/api/v1/player/alloha/proxy?${proxyParams.toString()}`,
      type: "iframe",
    })
  }, { detail: { tags: ["Players"], summary: "Alloha Player by TMDB ID" }, params: t.Object({ tmdbId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/alloha/kp/:kpId", async ({ params: { kpId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    const proxyParams = new URLSearchParams({ kp: String(kpId) })
    if (season) proxyParams.set("season", String(season))
    if (episode) proxyParams.set("episode", String(episode))

    return success({
      provider: "Alloha",
      url: `/api/v1/player/alloha/proxy?${proxyParams.toString()}`,
      type: "iframe",
    })
  }, { detail: { tags: ["Players"], summary: "Alloha Player by KP ID" }, params: t.Object({ kpId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/alloha/proxy", async ({ query }) => {
    const tmdb = query.tmdb
    const kp = query.kp
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    let allohaUrl: string
    if (tmdb) {
      allohaUrl = `https://api.alloha.tv/?token=${config.alloha.token}&tmdb=${tmdb}`
    } else if (kp) {
      allohaUrl = `https://api.alloha.tv/?token=${config.alloha.token}&kp=${kp}`
    } else {
      throw new BadRequestError("Missing tmdb or kp parameter")
    }
    if (season) allohaUrl += `&season=${season}`
    if (episode) allohaUrl += `&episode=${episode}`

    const res = await fetch(allohaUrl)
    if (!res.ok) throw new NotFoundError("Video not found on Alloha")

    const contentType = res.headers.get("content-type") || "text/html"
    const body = await res.text()

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
    })
  }, { detail: { tags: ["Players"], summary: "Alloha Proxy" }, query: t.Object({ tmdb: t.Optional(t.String()), kp: t.Optional(t.String()), season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/collaps/kp/:kpId", async ({ params: { kpId }, query }) => {
    if (!config.collaps.host || !config.collaps.token) throw new BadRequestError("Collaps not configured")

    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    const listUrl = `${config.collaps.host.replace(/\/$/, "")}/list?token=${config.collaps.token}&kinopoisk_id=${kpId}`
    const res = await fetch(listUrl)
    if (!res.ok) throw new BadRequestError("Video not found on Collaps")

    const data = await res.json() as any
    const result = data?.results?.[0]
    if (!result) throw new BadRequestError("No results from Collaps")

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

    if (!iframeUrl) throw new BadRequestError("No iframe URL found")

    return success({ provider: "Collaps", url: iframeUrl, type: "iframe" })
  }, { detail: { tags: ["Players"], summary: "Collaps Player" }, params: t.Object({ kpId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/cdn/:cdnId", async ({ params: { cdnId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    try {
      const data = await getPlayerData(cdnId, season, episode)
      return success({ provider: "CDN", ...data, type: "hls" })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
        throw new NotFoundError("video not found")
      }
      throw e
    }
  }, { detail: { tags: ["Players"], summary: "CDN Player" }, params: t.Object({ cdnId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/cdn/imdb/:imdbId", async ({ params: { imdbId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    let cdnId: number
    try {
      cdnId = await resolveCdnId(imdbId, "imdb")
    } catch {
      throw new NotFoundError("video not found")
    }

    try {
      const data = await getPlayerData(cdnId, season, episode)
      return success({ provider: "CDN", ...data, type: "hls" })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
        throw new NotFoundError("video not found")
      }
      throw e
    }
  }, { detail: { tags: ["Players"], summary: "CDN Player by IMDB ID" }, params: t.Object({ imdbId: t.String() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/cdn/kp/:kpId", async ({ params: { kpId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    let cdnId: number
    try {
      cdnId = await resolveCdnId(String(kpId), "kp")
    } catch {
      throw new NotFoundError("video not found")
    }

    try {
      const data = await getPlayerData(cdnId, season, episode)
      return success({ provider: "CDN", ...data, type: "hls" })
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
        throw new NotFoundError("video not found")
      }
      throw e
    }
  }, { detail: { tags: ["Players"], summary: "CDN Player by KP ID" }, params: t.Object({ kpId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })

  .get("/api/v1/player/hls/proxy", async ({ query, request }) => {
    const url = query.url
    if (!url) throw new BadRequestError("Missing url parameter")

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) throw new BadRequestError("Failed to fetch HLS stream")

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
  }, { detail: { tags: ["Players"], summary: "HLS Proxy" }, query: t.Object({ url: t.String() }) })
