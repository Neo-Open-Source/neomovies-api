import { Elysia, t } from "elysia"
import { config } from "../../config"
import { success } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"

export const allohaRoutes = new Elysia()

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
