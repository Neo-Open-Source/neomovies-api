import { Elysia, t } from "elysia"
import { config } from "../../config"
import { success } from "../../lib/response"
import { NotFoundError, BadRequestError } from "../../lib/errors"
import { getAllohaPlayer, getAllohaPlayerUrl } from "../../services/players"

export const allohaRoutes = new Elysia()

  .get("/api/v1/player/alloha/tmdb/:tmdbId", async ({ params: { tmdbId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      const data = await getAllohaPlayerUrl(undefined, tmdbId, undefined, season, episode)
      return success({ provider: "Alloha", ...data })
    }

    const html = await getAllohaPlayer(undefined, tmdbId, undefined, season, episode)
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
  }, {
    detail: { tags: ["Players"], summary: "Alloha Player by TMDB ID" },
    params: t.Object({ tmdbId: t.Numeric() }),
    query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()), format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])) }),
  })

  .get("/api/v1/player/alloha/kp/:kpId", async ({ params: { kpId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      const data = await getAllohaPlayerUrl(kpId, undefined, undefined, season, episode)
      return success({ provider: "Alloha", ...data })
    }

    const html = await getAllohaPlayer(kpId, undefined, undefined, season, episode)
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
  }, {
    detail: { tags: ["Players"], summary: "Alloha Player by KP ID" },
    params: t.Object({ kpId: t.Numeric() }),
    query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()), format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])) }),
  })

  .get("/api/v1/player/alloha/imdb/:imdbId", async ({ params: { imdbId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      const data = await getAllohaPlayerUrl(undefined, undefined, imdbId, season, episode)
      return success({ provider: "Alloha", ...data })
    }

    const html = await getAllohaPlayer(undefined, undefined, imdbId, season, episode)
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
  }, {
    detail: { tags: ["Players"], summary: "Alloha Player by IMDB ID" },
    params: t.Object({ imdbId: t.String() }),
    query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()), format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])) }),
  })

  .get("/api/v1/player/alloha/proxy", async ({ query }) => {
    const tmdb = query.tmdb
    const kp = query.kp
    const imdb = query.imdb
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    let allohaUrl: string
    if (tmdb) {
      allohaUrl = `https://api.alloha.tv/?token=${config.alloha.token}&tmdb=${tmdb}`
    } else if (kp) {
      allohaUrl = `https://api.alloha.tv/?token=${config.alloha.token}&kp=${kp}`
    } else if (imdb) {
      allohaUrl = `https://api.alloha.tv/?token=${config.alloha.token}&imdb=${imdb}`
    } else {
      throw new BadRequestError("Missing tmdb, kp, or imdb parameter")
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
  }, {
    detail: { tags: ["Players"], summary: "Alloha Proxy" },
    query: t.Object({
      tmdb: t.Optional(t.String()),
      kp: t.Optional(t.String()),
      imdb: t.Optional(t.String()),
      season: t.Optional(t.String()),
      episode: t.Optional(t.String()),
    }),
  })
