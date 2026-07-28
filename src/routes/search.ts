import { Elysia } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { mapMovie, mapTV, paginate } from "../lib/mappers"

export const searchRoutes = new Elysia()

  .get("/api/v1/search", async ({ query }) => {
    const { q, type, genre, year, rating, keyword, country, sort_by, page } = query as Record<string, string | undefined>
    const p = parseInt(page || "1")

    if (q) {
      const mediaType = type || "multi"
      const params: Record<string, string> = { query: q, page: String(p) }
      if (country) params.with_original_language = country

      if (mediaType === "movie") {
        const data = await tmdb.searchMovie(q, p)
        return success(paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results))
      }

      if (mediaType === "tv") {
        const data = await tmdb.searchTV(q, p)
        return success(paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results))
      }

      const data = await tmdb.searchMulti(q, p)
      return success(paginate(
        data.results.map((item) => {
          if (item.media_type === "movie") return { ...mapMovie(item as any), mediaType: "movie" }
          if (item.media_type === "tv") return { ...mapTV(item as any), mediaType: "tv" }
          const person = item as any
          return { mediaType: "person", tmdbId: person.id, name: person.name, profile: tmdb.imageUrl(person.profile_path, "w185"), department: person.known_for_department }
        }),
        data.page, data.total_pages, data.total_results,
      ))
    }

    const discoverParams: Record<string, string> = {}
    if (genre) discoverParams.with_genres = genre
    if (year) discoverParams["primary_release_date.gte"] = `${year}-01-01`
    if (year) discoverParams["primary_release_date.lte"] = `${year}-12-31`
    if (rating) discoverParams["vote_average.gte"] = rating
    if (keyword) discoverParams.with_keywords = keyword
    if (country) discoverParams.with_original_language = country
    discoverParams.sort_by = sort_by || "popularity.desc"
    if (page) discoverParams.page = page

    const mediaType = type || "movie"
    if (mediaType === "tv") {
      const data = await tmdb.discoverTV(discoverParams)
      return success(paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results))
    }

    const data = await tmdb.discoverMovie(discoverParams)
    return success(paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results))
  })
