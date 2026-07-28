import { Elysia } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"

export const genreRoutes = new Elysia()

  .get("/api/v1/genre/movie", async () => {
    const { genres } = await tmdb.movieGenres()
    return success(genres.map((g) => ({ id: g.id, name: g.name })))
  })

  .get("/api/v1/genre/tv", async () => {
    const { genres } = await tmdb.tvGenres()
    return success(genres.map((g) => ({ id: g.id, name: g.name })))
  })
