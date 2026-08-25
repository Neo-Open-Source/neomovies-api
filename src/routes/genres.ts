import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { language } from "../lib/language"

export const genreRoutes = new Elysia()
  .get("/api/v1/genres", async ({ query, set }) => {
    const lang = language(query)
    const [movie, tv] = await Promise.all([
      tmdb.movieGenres(lang).catch(() => ({ genres: [] })),
      tmdb.tvGenres(lang).catch(() => ({ genres: [] })),
    ])

    set.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"

    return success({ movie: movie.genres, tv: tv.genres })
  }, {
    detail: { tags: ["Genres"], summary: "List Movie and TV Genres" },
    query: t.Object({ language: t.Optional(t.String()) }),
  })
