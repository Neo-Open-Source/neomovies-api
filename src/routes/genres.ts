import { Elysia } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { language } from "../lib/language"

export const genreRoutes = new Elysia()

  .get("/api/v1/genre/movie", async ({ query }) => {
    const { genres } = await tmdb.movieGenres(language(query))
    return success(genres.map((g) => ({ id: g.id, name: g.name })))
  }, {
    detail: { tags: ["Genres"], summary: "Movie Genres" },
  })

  .get("/api/v1/genre/tv", async ({ query }) => {
    const { genres } = await tmdb.tvGenres(language(query))
    return success(genres.map((g) => ({ id: g.id, name: g.name })))
  }, {
    detail: { tags: ["Genres"], summary: "TV Genres" },
  })
