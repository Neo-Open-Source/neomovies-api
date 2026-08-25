import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { page } from "../lib/query"
import { language } from "../lib/language"
import { BadRequestError } from "../lib/errors"

const MediaType = t.Enum({ movie: "movie", tv: "tv" })

export const mediaRoutes = new Elysia()

  .get("/api/v1/media/:type/:id", async ({ params: { type, id }, query }) =>
    success(await (type === "movie" ? media.movieDetail(id, language(query)) : media.tvDetail(id, language(query)))), {
    detail: { tags: ["Media"], summary: "Media Details" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/credits", async ({ params: { type, id }, query }) =>
    success(await (type === "movie" ? media.movieCredits(id, language(query)) : media.tvCredits(id, language(query)))), {
    detail: { tags: ["Media"], summary: "Media Credits" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/recommendations", async ({ params: { type, id }, query }) =>
    success(await media.recommendations(type, id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Media Recommendations" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/similar", async ({ params: { type, id }, query }) =>
    success(await media.similar(type, id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Similar Media" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/related/cast", async ({ params: { type, id }, query }) =>
    success(await media.relatedByCast(type, id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Related by Cast" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/related/studio", async ({ params: { type, id }, query }) =>
    success(await media.relatedByStudio(type, id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Related by Studio / Network" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/collection", async ({ params: { type, id }, query }) => {
    if (type !== "movie") throw new BadRequestError("Collections are only available for movies")
    return success(await media.collection(id, language(query)))
  }, {
    detail: { tags: ["Media"], summary: "Movie Collection" },
    params: t.Object({ type: MediaType, id: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/season/:season", async ({ params: { type, id, season }, query }) => {
    if (type !== "tv") throw new BadRequestError("Seasons are only available for TV shows")
    return success(await media.season(id, season, language(query)))
  }, {
    detail: { tags: ["Media"], summary: "Season Details" },
    params: t.Object({ type: MediaType, id: t.Numeric(), season: t.Numeric() }),
  })

  .get("/api/v1/media/:type/:id/season/:season/episode/:episode", async ({ params: { type, id, season, episode }, query }) => {
    if (type !== "tv") throw new BadRequestError("Episodes are only available for TV shows")
    return success(await media.episode(id, season, episode, language(query)))
  }, {
    detail: { tags: ["Media"], summary: "Episode Details" },
    params: t.Object({ type: MediaType, id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })

  .get("/api/v1/movies/:list", async ({ params: { list }, query }) =>
    success(await media.list("movie", list, page(query), language(query))), {
    detail: {
      tags: ["Media"],
      summary: "Movie List",
      parameters: [{
        name: "list",
        in: "path",
        required: true,
        schema: { type: "string", enum: ["popular", "top-rated", "upcoming"] },
      }],
    },
    params: t.Object({ list: t.Enum({ popular: "popular", "top-rated": "top-rated", upcoming: "upcoming" }) }),
  })

  .get("/api/v1/tv/:list", async ({ params: { list }, query }) =>
    success(await media.list("tv", list, page(query), language(query))), {
    detail: {
      tags: ["Media"],
      summary: "TV List",
      parameters: [{
        name: "list",
        in: "path",
        required: true,
        schema: { type: "string", enum: ["popular", "top-rated"] },
      }],
    },
    params: t.Object({ list: t.Enum({ popular: "popular", "top-rated": "top-rated" }) }),
  })

  .get("/api/v1/trending", async ({ query }) => {
    const typeFilter = query.type === "movie" || query.type === "tv" ? query.type : undefined
    return success(await media.trending("popular", page(query), language(query), typeFilter))
  }, {
    detail: {
      tags: ["Media"],
      summary: "Trending",
      description: "Popular movies and TV shows, mixed or filtered by the type query parameter",
    },
    query: t.Object({
      type: t.Optional(t.String()),
      page: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  })
