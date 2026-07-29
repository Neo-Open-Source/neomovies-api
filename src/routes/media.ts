import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { page } from "../lib/query"
import { language } from "../lib/language"

export const mediaRoutes = new Elysia()

  .get("/api/v1/movie/:id", async ({ params: { id }, query }) =>
    success(await media.movieDetail(id, language(query))), {
    detail: { tags: ["Media"], summary: "Movie Details" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id", async ({ params: { id }, query }) =>
    success(await media.tvDetail(id, language(query))), {
    detail: { tags: ["Media"], summary: "TV Show Details" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/collection", async ({ params: { id }, query }) =>
    success(await media.collection(id, language(query))), {
    detail: { tags: ["Media"], summary: "Movie Collection" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/credits", async ({ params: { id }, query }) =>
    success(await media.movieCredits(id, language(query))), {
    detail: { tags: ["Media"], summary: "Movie Credits" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/credits", async ({ params: { id }, query }) =>
    success(await media.tvCredits(id, language(query))), {
    detail: { tags: ["Media"], summary: "TV Credits" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season", async ({ params: { id, season }, query }) =>
    success(await media.season(id, season, language(query))), {
    detail: { tags: ["Media"], summary: "Season Details" },
    params: t.Object({ id: t.Numeric(), season: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season/episode/:episode", async ({ params: { id, season, episode }, query }) =>
    success(await media.episode(id, season, episode, language(query))), {
    detail: { tags: ["Media"], summary: "Episode Details" },
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/recommendations", async ({ params: { id }, query }) =>
    success(await media.recommendations("movie", id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Movie Recommendations" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/recommendations", async ({ params: { id }, query }) =>
    success(await media.recommendations("tv", id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "TV Recommendations" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/similar", async ({ params: { id }, query }) =>
    success(await media.similar("movie", id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Similar Movies" },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/similar", async ({ params: { id }, query }) =>
    success(await media.similar("tv", id, page(query), language(query))), {
    detail: { tags: ["Media"], summary: "Similar TV Shows" },
    params: t.Object({ id: t.Numeric() }),
  })


  .get("/api/v1/trending/:sort", async ({ params: { sort }, query }) => {
    const typeFilter = query.type === "movie" || query.type === "tv" ? query.type : undefined
    return success(await media.trending(sort, page(query), language(query), typeFilter))
  }, {
    detail: { tags: ["Media"], summary: "Trending — mixed or filtered by type" },
    params: t.Object({ sort: t.String() }),
    query: t.Object({
      type: t.Optional(t.String()),
      page: t.Optional(t.String()),
      language: t.Optional(t.String()),
    }),
  })
