import { Elysia, t } from "elysia"
import { success } from "../../lib/response"
import { NotFoundError } from "../../lib/errors"
import { getPlayerData, resolveCdnId } from "../../services/cdn"

async function fetchCdnPlayer(cdnId: number, season?: number, episode?: number) {
  try {
    return await getPlayerData(cdnId, season, episode)
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("not found") || msg.includes("no episodes") || msg.includes("no video")) {
      throw new NotFoundError("video not found")
    }
    throw e
  }
}

export const cdnRoutes = new Elysia()

  .get("/api/v1/player/cdn/:cdnId", async ({ params: { cdnId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const data = await fetchCdnPlayer(cdnId, season, episode)
    return success({ provider: "CDN", ...data, type: "hls" })
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

    const data = await fetchCdnPlayer(cdnId, season, episode)
    return success({ provider: "CDN", ...data, type: "hls" })
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

    const data = await fetchCdnPlayer(cdnId, season, episode)
    return success({ provider: "CDN", ...data, type: "hls" })
  }, { detail: { tags: ["Players"], summary: "CDN Player by KP ID" }, params: t.Object({ kpId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })
