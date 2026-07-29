import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { NotFoundError, BadRequestError } from "../lib/errors"
import { BACKDROP_SIZES, STILL_SIZES } from "../lib/images"
import { language } from "../lib/language"
import { config } from "../config"

export const imageRoutes = new Elysia()

  .get("/image/*", async ({ request }) => {
    const url = new URL(request.url)
    const imagePath = url.pathname.replace("/image/", "")

    if (!imagePath) throw new BadRequestError("Missing image path")

    const tmdbUrl = `${config.tmdb.imageBaseUrl}/original/${imagePath}`

    const res = await fetch(tmdbUrl)
    if (!res.ok) throw new BadRequestError("Image not found")

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  })

  .get("/api/v1/movie/:id/backdrops", async ({ params: { id }, query }) => {
    const movie = await tmdb.movie(id, language(query))
    if (!movie.backdrop_path) throw new NotFoundError("No backdrops")

    const size = (query as any)?.size
    if (size && BACKDROP_SIZES.includes(size as any)) {
      return success({ backdrop: tmdb.imageUrl(movie.backdrop_path, size) })
    }

    return success({
      backdrops: tmdb.imageSizes(movie.backdrop_path, BACKDROP_SIZES),
    })
  }, {
    detail: { tags: ["Images"], summary: "Movie Backdrops" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/backdrops", async ({ params: { id }, query }) => {
    const lang = language(query)
    const [show, externalIds] = await Promise.all([
      tmdb.tvShow(id, lang),
      tmdb.tvExternalIds(id).catch(() => null),
    ])
    if (!show.backdrop_path) throw new NotFoundError("No backdrops")

    const size = (query as any)?.size
    if (size && BACKDROP_SIZES.includes(size as any)) {
      return success({ backdrop: tmdb.imageUrl(show.backdrop_path, size) })
    }

    return success({
      backdrops: tmdb.imageSizes(show.backdrop_path, BACKDROP_SIZES),
      imdbId: externalIds?.imdb_id ?? null,
    })
  }, {
    detail: { tags: ["Images"], summary: "TV Backdrops" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season/episode/:episode/stills", async ({ params: { id, season, episode }, query }) => {
    const ep = await tmdb.tvEpisode(id, season, episode, language(query))
    if (!ep.still_path) throw new NotFoundError("No stills")

    const size = (query as any)?.size
    if (size && STILL_SIZES.includes(size as any)) {
      return success({ still: tmdb.imageUrl(ep.still_path, size) })
    }

    return success({
      stills: tmdb.imageSizes(ep.still_path, STILL_SIZES),
    })
  }, {
    detail: { tags: ["Images"], summary: "Episode Stills" },
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })
