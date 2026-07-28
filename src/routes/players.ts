import { Elysia, t } from "elysia"
import { success, badRequest } from "../lib/response"

interface PlayerConfig {
  name: string
  baseUrl: string
  type: "iframe"
  buildUrl(kpId: number, season?: number, episode?: number): string
}

const players: Record<string, PlayerConfig> = {
  alloha: {
    name: "Alloha",
    baseUrl: "https://alloha.tv",
    type: "iframe",
    buildUrl(kpId) {
      return `https://api.alloha.tv/?kp_id=${kpId}&player=1`
    },
  },
  vibix: {
    name: "Vibix",
    baseUrl: "https://vibix.pro",
    type: "iframe",
    buildUrl(kpId) {
      return `https://vibix.pro/api/player?kp=${kpId}`
    },
  },
  neowatch: {
    name: "NeoWatch",
    baseUrl: "",
    type: "iframe",
    buildUrl(kpId, season, episode) {
      let url = `https://neome.uk/player?kp=${kpId}`
      if (season) url += `&season=${season}`
      if (episode) url += `&episode=${episode}`
      return url
    },
  },
}

export const playerRoutes = new Elysia()

  .get("/api/v1/player/:provider/kp/:kpId", async ({ params: { provider, kpId }, query }) => {
    const player = players[provider]
    if (!player) return badRequest(`Unknown player provider: ${provider}`)

    const q = query as Record<string, string | undefined>
    const season = q.season ? parseInt(q.season) : undefined
    const episode = q.episode ? parseInt(q.episode) : undefined

    return success({
      provider: player.name,
      url: player.buildUrl(kpId, season, episode),
      type: player.type,
    })
  }, {
    params: t.Object({ provider: t.String(), kpId: t.Numeric() }),
  })

  .get("/api/v1/player/cdn/:cdnId", async ({ params: { cdnId } }) => {
    return success({
      provider: "CDN",
      url: `https://neome.uk/cdn/${cdnId}`,
      type: "hls",
    })
  }, {
    params: t.Object({ cdnId: t.String() }),
  })

  .get("/api/v1/player/cdn/tmdb/:tmdbId", async ({ params: { tmdbId } }) => {
    return success({
      provider: "CDN",
      url: `https://neome.uk/api/v1/players/cdn/tmdb/${tmdbId}`,
      type: "hls",
    })
  }, {
    params: t.Object({ tmdbId: t.Numeric() }),
  })

  .get("/api/v1/player/hls/proxy", async ({ query, request }) => {
    const { url } = query as { url?: string }
    if (!url) return badRequest("Missing url parameter")

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    if (!res.ok) return badRequest("Failed to fetch HLS stream")

    const contentType = res.headers.get("content-type") || ""
    const text = await res.text()

    if (!contentType.includes("mpegurl") && !text.startsWith("#EXTM3U")) {
      // binary segment — return as-is
      return new Response(await res.arrayBuffer(), {
        headers: {
          "Content-Type": contentType || "video/MP2T",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=604800",
        },
      })
    }

    const baseUrl = new URL(url)
    const proxyBase = `${request.url.split("?")[0]}?url=`
    const encode = (u: string) => encodeURIComponent(u)

    const rewritten = text.split("\n").map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("http")) return line
      if (trimmed.startsWith("//")) return line // protocol-relative

      // relative path → absolute proxy URL
      const absolute = new URL(trimmed, baseUrl.origin + baseUrl.pathname).href
      return `${proxyBase}${encode(absolute)}`
    }).join("\n")

    return new Response(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache",
      },
    })
  })
