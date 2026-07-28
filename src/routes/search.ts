import { Elysia } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"

export const searchRoutes = new Elysia()

  .get("/api/v1/search/multi", async ({ query }) => {
    const { q, page } = query as { q?: string; page?: string }
    if (!q) return success({ items: [], page: 1, totalPages: 0, totalResults: 0 })
    const p = parseInt(page || "1")
    const data = await tmdb.searchMulti(q, p)
    return success({
      items: data.results.map((item) => {
        if (item.media_type === "movie") {
          const m = item as any
          return { mediaType: "movie", id: m.id, title: m.title, originalTitle: m.original_title, overview: m.overview, posterPath: tmdb.imageUrl(m.poster_path, "w342"), backdropPath: tmdb.imageUrl(m.backdrop_path, "w780"), releaseDate: m.release_date || "", voteAverage: m.vote_average }
        }
        if (item.media_type === "tv") {
          const t = item as any
          return { mediaType: "tv", id: t.id, title: t.name, originalTitle: t.original_name, overview: t.overview, posterPath: tmdb.imageUrl(t.poster_path, "w342"), backdropPath: tmdb.imageUrl(t.backdrop_path, "w780"), releaseDate: t.first_air_date || "", voteAverage: t.vote_average }
        }
        const p = item as any
        return { mediaType: "person", id: p.id, title: p.name, profilePath: tmdb.imageUrl(p.profile_path, "w185"), department: p.known_for_department }
      }),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    })
  })

  .get("/api/v1/search/movie", async ({ query }) => {
    const { q, page } = query as { q?: string; page?: string }
    if (!q) return success({ items: [], page: 1, totalPages: 0, totalResults: 0 })
    const p = parseInt(page || "1")
    const data = await tmdb.searchMovie(q, p)
    return success({
      items: data.results.map((m) => ({
        id: m.id, title: m.title, originalTitle: m.original_title, overview: m.overview,
        posterPath: tmdb.imageUrl(m.poster_path, "w342"), releaseDate: m.release_date || "",
        voteAverage: m.vote_average, genreIds: m.genre_ids,
      })),
      page: data.page, totalPages: data.total_pages, totalResults: data.total_results,
    })
  })

  .get("/api/v1/search/tv", async ({ query }) => {
    const { q, page } = query as { q?: string; page?: string }
    if (!q) return success({ items: [], page: 1, totalPages: 0, totalResults: 0 })
    const p = parseInt(page || "1")
    const data = await tmdb.searchTV(q, p)
    return success({
      items: data.results.map((t) => ({
        id: t.id, title: t.name, originalTitle: t.original_name, overview: t.overview,
        posterPath: tmdb.imageUrl(t.poster_path, "w342"), releaseDate: t.first_air_date || "",
        voteAverage: t.vote_average, genreIds: t.genre_ids,
      })),
      page: data.page, totalPages: data.total_pages, totalResults: data.total_results,
    })
  })
