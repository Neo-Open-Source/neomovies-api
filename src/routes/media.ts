import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { page } from "../lib/query"
import { language } from "../lib/language"

export const mediaRoutes = new Elysia()

  .get("/api/v1/movie/:id", async ({ params: { id }, query }) =>
    success(await media.movieDetail(id, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id", async ({ params: { id }, query }) =>
    success(await media.tvDetail(id, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/collection", async ({ params: { id }, query }) =>
    success(await media.collection(id, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/credits", async ({ params: { id }, query }) =>
    success(await media.movieCredits(id, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/credits", async ({ params: { id }, query }) =>
    success(await media.tvCredits(id, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season", async ({ params: { id, season }, query }) =>
    success(await media.season(id, season, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric(), season: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/season/:season/episode/:episode", async ({ params: { id, season, episode }, query }) =>
    success(await media.episode(id, season, episode, language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/recommendations", async ({ params: { id }, query }) =>
    success(await media.recommendations("movie", id, page(query), language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/recommendations", async ({ params: { id }, query }) =>
    success(await media.recommendations("tv", id, page(query), language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/:id/similar", async ({ params: { id }, query }) =>
    success(await media.similar("movie", id, page(query), language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/tv/:id/similar", async ({ params: { id }, query }) =>
    success(await media.similar("tv", id, page(query), language(query))), {
    detail: { tags: ["Media"] },
    params: t.Object({ id: t.Numeric() }),
  })

  .get("/api/v1/movie/popular", async ({ query }) =>
    success(await media.list("movie", "popular", page(query), language(query))), {
    detail: { tags: ["Media"] },
  })

  .get("/api/v1/movie/top-rated", async ({ query }) =>
    success(await media.list("movie", "top-rated", page(query), language(query))), {
    detail: { tags: ["Media"] },
  })

  .get("/api/v1/movie/upcoming", async ({ query }) =>
    success(await media.list("movie", "upcoming", page(query), language(query))), {
    detail: { tags: ["Media"] },
  })

  .get("/api/v1/tv/popular", async ({ query }) =>
    success(await media.list("tv", "popular", page(query), language(query))), {
    detail: { tags: ["Media"] },
  })

  .get("/api/v1/tv/top-rated", async ({ query }) =>
    success(await media.list("tv", "top-rated", page(query), language(query))), {
    detail: { tags: ["Media"] },
  })
