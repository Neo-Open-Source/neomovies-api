import { Elysia, t } from "elysia"
import { success } from "../../lib/response"
import { BadRequestError } from "../../lib/errors"
import { getCollapsPlayer, getCollapsPlayerUrl } from "../../services/players"

export const collapsRoutes = new Elysia()

  .get("/api/v1/player/collaps/kp/:kpId", async ({ params: { kpId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      try {
        const data = await getCollapsPlayerUrl(kpId, undefined, season, episode)
        return success({ provider: "Collaps", ...data })
      } catch (e) {
        const msg = (e as Error).message
        if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
        throw new BadRequestError("Video not found on Collaps")
      }
    }

    try {
      const html = await getCollapsPlayer(kpId, undefined, season, episode)
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
    } catch (e) {
      const msg = (e as Error).message
      if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
      throw new BadRequestError("Video not found on Collaps")
    }
  }, {
    detail: { tags: ["Players"], summary: "Collaps Player by KP ID" },
    params: t.Object({ kpId: t.Numeric() }),
    query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()), format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])) }),
  })

  .get("/api/v1/player/collaps/imdb/:imdbId", async ({ params: { imdbId }, query }) => {
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      try {
        const data = await getCollapsPlayerUrl(undefined, imdbId, season, episode)
        return success({ provider: "Collaps", ...data })
      } catch (e) {
        const msg = (e as Error).message
        if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
        throw new BadRequestError("Video not found on Collaps")
      }
    }

    try {
      const html = await getCollapsPlayer(undefined, imdbId, season, episode)
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
    } catch (e) {
      const msg = (e as Error).message
      if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
      throw new BadRequestError("Video not found on Collaps")
    }
  }, {
    detail: { tags: ["Players"], summary: "Collaps Player by IMDB ID" },
    params: t.Object({ imdbId: t.String() }),
    query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()), format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])) }),
  })

  .get("/api/v1/player/collaps/proxy", async ({ query }) => {
    const kp = query.kp
    const imdb = query.imdb
    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined
    const format = query.format ?? "html"

    if (format === "url") {
      try {
        const data = await getCollapsPlayerUrl(
          kp ? Number(kp) : undefined,
          imdb ?? undefined,
          season,
          episode,
        )
        return success({ provider: "Collaps", ...data })
      } catch (e) {
        const msg = (e as Error).message
        if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
        throw new BadRequestError("Video not found on Collaps")
      }
    }

    try {
      const html = await getCollapsPlayer(
        kp ? Number(kp) : undefined,
        imdb ?? undefined,
        season,
        episode,
      )
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" } })
    } catch (e) {
      const msg = (e as Error).message
      if (msg === "not_configured") throw new BadRequestError("Collaps not configured")
      throw new BadRequestError("Video not found on Collaps")
    }
  }, {
    detail: { tags: ["Players"], summary: "Collaps Proxy" },
    query: t.Object({
      kp: t.Optional(t.String()),
      imdb: t.Optional(t.String()),
      season: t.Optional(t.String()),
      episode: t.Optional(t.String()),
      format: t.Optional(t.Union([t.Literal("html"), t.Literal("url")])),
    }),
  })
