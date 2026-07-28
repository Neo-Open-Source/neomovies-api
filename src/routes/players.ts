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

  .get("/api/v1/player/hls/proxy", async ({ query }) => {
    const { url } = query as { url?: string }
    if (!url) return badRequest("Missing url parameter")

    const res = await fetch(url)
    if (!res.ok) return badRequest("Failed to fetch HLS stream")

    return new Response(res.body, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
      },
    })
  })
