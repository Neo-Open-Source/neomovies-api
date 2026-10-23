import { Elysia, t } from "elysia"
import { success } from "../../lib/response"
import { BadRequestError } from "../../lib/errors"
import { getKodikById, pickKodikLink, searchKodik, type KodikPlaylist } from "../../services/kodik"
import { iframeHtml } from "../../services/players"
import { resolveIds } from "../../services/alloha"

const kodikQuery = t.Object({
  season: t.Optional(t.String()),
  episode: t.Optional(t.String()),
  translation: t.Optional(t.String()),
  format: t.Optional(t.Union([t.Literal("html"), t.Literal("url"), t.Literal("json")])),
})

interface KodikPlayerQuery {
  season?: string
  episode?: string
  translation?: string
  format?: "html" | "url" | "json"
}

function parseIntParam(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

function playerResponse(playlist: KodikPlaylist, query: KodikPlayerQuery) {
  const url = pickKodikLink(
    playlist,
    parseIntParam(query.translation),
    parseIntParam(query.season),
    parseIntParam(query.episode),
  )
  if (!url) throw new BadRequestError("Video not found on Kodik")

  if (query.format === "url") {
    return success({ provider: "Kodik", url, type: "iframe" })
  }
  return new Response(iframeHtml(url, "Kodik Player"), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  })
}

async function handleKodikRequest(
  loader: () => Promise<KodikPlaylist>,
  query: KodikPlayerQuery,
) {
  try {
    const playlist = await loader()
    if (query.format === "json") return success(playlist)
    return playerResponse(playlist, query)
  } catch (e) {
    if (e instanceof BadRequestError) throw e
    if ((e as Error).message === "not_configured") throw new BadRequestError("Kodik not configured")
    throw new BadRequestError("Video not found on Kodik")
  }
}

export const kodikRoutes = new Elysia()

  .get("/api/v1/player/kodik/search", async ({ query }) => {
    try {
      return success(await searchKodik(query.title, query.limit ? Number(query.limit) : 20))
    } catch (e) {
      if ((e as Error).message === "not_configured") throw new BadRequestError("Kodik not configured")
      throw new BadRequestError("Kodik search failed")
    }
  }, {
    detail: { tags: ["Players"], summary: "Kodik Search by Title" },
    query: t.Object({ title: t.String({ minLength: 1 }), limit: t.Optional(t.String()) }),
  })

  .get("/api/v1/player/kodik/kp/:kpId", async ({ params: { kpId }, query }) => {
    return handleKodikRequest(() => getKodikById("kinopoisk_id", String(kpId)), query)
  }, {
    detail: { tags: ["Players"], summary: "Kodik Player by KP ID" },
    params: t.Object({ kpId: t.Numeric() }),
    query: kodikQuery,
  })

  .get("/api/v1/player/kodik/imdb/:imdbId", async ({ params: { imdbId }, query }) => {
    return handleKodikRequest(() => getKodikById("imdb_id", imdbId), query)
  }, {
    detail: { tags: ["Players"], summary: "Kodik Player by IMDB ID" },
    params: t.Object({ imdbId: t.String() }),
    query: kodikQuery,
  })

  .get("/api/v1/player/kodik/shikimori/:shikimoriId", async ({ params: { shikimoriId }, query }) => {
    return handleKodikRequest(() => getKodikById("shikimori_id", String(shikimoriId)), query)
  }, {
    detail: { tags: ["Players"], summary: "Kodik Player by Shikimori ID" },
    params: t.Object({ shikimoriId: t.Numeric() }),
    query: kodikQuery,
  })

  .get("/api/v1/player/kodik/tmdb/:tmdbId", async ({ params: { tmdbId }, query }) => {
    const mediaType = query.type === "tv" ? "tv" : "movie"
    const { kpId, imdbId } = await resolveIds(tmdbId, mediaType)
    if (kpId) return handleKodikRequest(() => getKodikById("kinopoisk_id", String(kpId)), query)
    if (imdbId) return handleKodikRequest(() => getKodikById("imdb_id", imdbId), query)
    throw new BadRequestError("No KP or IMDB id for this title")
  }, {
    detail: { tags: ["Players"], summary: "Kodik Player by TMDB ID" },
    params: t.Object({ tmdbId: t.Numeric() }),
    query: t.Composite([kodikQuery, t.Object({ type: t.Optional(t.Union([t.Literal("movie"), t.Literal("tv")])) })]),
  })

  .get("/api/v1/player/kodik/proxy", async ({ query }) => {
    const { kp, imdb, shikimori } = query
    if (kp) return handleKodikRequest(() => getKodikById("kinopoisk_id", kp), query)
    if (imdb) return handleKodikRequest(() => getKodikById("imdb_id", imdb), query)
    if (shikimori) return handleKodikRequest(() => getKodikById("shikimori_id", shikimori), query)
    throw new BadRequestError("Missing kp, imdb or shikimori id")
  }, {
    detail: { tags: ["Players"], summary: "Kodik Proxy" },
    query: t.Composite([kodikQuery, t.Object({
      kp: t.Optional(t.String()),
      imdb: t.Optional(t.String()),
      shikimori: t.Optional(t.String()),
    })]),
  })
