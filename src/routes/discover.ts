import { Elysia } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"

export const discoverRoutes = new Elysia()

  .get("/api/v1/discover/movie", async ({ query }) => {
    const { genre, year, country, keyword, company, sort_by, page } = query as Record<string, string | undefined>
    const params: Record<string, string> = {}
    if (genre) params.with_genres = genre
    if (year) params["primary_release_date.gte"] = `${year}-01-01`
    if (year) params["primary_release_date.lte"] = `${year}-12-31`
    if (country) params.with_original_language = country
    if (keyword) params.with_keywords = keyword
    if (company) params.with_companies = company
    params.sort_by = sort_by || "popularity.desc"
    if (page) params.page = page

    const data = await tmdb.discoverMovie(params)
    return success({
      items: data.results.map((m: any) => ({
        id: m.id, title: m.title, overview: m.overview,
        posterPath: tmdb.imageUrl(m.poster_path, "w342"),
        backdropPath: tmdb.imageUrl(m.backdrop_path, "w780"),
        releaseDate: m.release_date || "",
        voteAverage: m.vote_average, genreIds: m.genre_ids,
      })),
      page: data.page, totalPages: data.total_pages, totalResults: data.total_results,
    })
  })

  .get("/api/v1/discover/tv", async ({ query }) => {
    const { genre, year, country, keyword, company, sort_by, page } = query as Record<string, string | undefined>
    const params: Record<string, string> = {}
    if (genre) params.with_genres = genre
    if (year) params["first_air_date_year"] = year
    if (country) params.with_original_language = country
    if (keyword) params.with_keywords = keyword
    if (company) params.with_companies = company
    params.sort_by = sort_by || "popularity.desc"
    if (page) params.page = page

    const data = await tmdb.discoverTV(params)
    return success({
      items: data.results.map((t: any) => ({
        id: t.id, title: t.name, overview: t.overview,
        posterPath: tmdb.imageUrl(t.poster_path, "w342"),
        backdropPath: tmdb.imageUrl(t.backdrop_path, "w780"),
        releaseDate: t.first_air_date || "",
        voteAverage: t.vote_average, genreIds: t.genre_ids,
      })),
      page: data.page, totalPages: data.total_pages, totalResults: data.total_results,
    })
  })
