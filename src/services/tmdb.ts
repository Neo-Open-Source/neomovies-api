import { config } from "../config"
import { DEFAULT_LANGUAGE } from "../lib/language"
import type {
  TMDBDiscoverParams,
  TMDBEpisode,
  TMDBGenre,
  TMDBMovieDetails,
  TMDBMovie,
  TMDBMultiResult,
  TMDBPageResult,
  TMDBSeasonDetails,
  TMDBTVDetails,
  TMDBTVShow,
  TMDBVideo,
} from "../types/tmdb"
import { TMDBCache } from "./tmdb/cache"
import { buildDefaultParams, filterMovies, filterMulti, filterTV, MIN_VOTE_COUNT } from "./tmdb/filters"

export class TMDBClient {
  private cache = new TMDBCache()
  private baseUrl = config.tmdb.baseUrl
  private headers: Record<string, string>

  constructor() {
    this.headers = {
      Authorization: `Bearer ${config.tmdb.accessToken}`,
      accept: "application/json",
    }
  }

  private generateCacheKey(
    path: string,
    queryParams?: Record<string, string>
  ): string {
    if (!queryParams) return path

    const sortedQuery = Object.entries(queryParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&")

    return `${path}?${sortedQuery}`
  }

  public async get<T>(
    path: string,
    queryParams?: Record<string, string>
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(path, queryParams)
    const cachedData = this.cache.get<T>(cacheKey)

    if (cachedData) return cachedData

    const url = new URL(`${this.baseUrl}${path}`)
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
    }

    const response = await fetch(url.toString(), { headers: this.headers })
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as T
    this.cache.set(cacheKey, data)

    return data
  }

  public imageUrl(path: string | null, size: string = "w500"): string | null {
    if (!path) return null
    return `/image/${size}${path}`
  }

  public imageSizes(
    path: string | null,
    sizes: readonly string[]
  ): Record<string, string | null> {
    const result: Record<string, string | null> = {}

    if (!path) {
      for (const size of sizes) result[size] = null
      return result
    }

    for (const size of sizes) {
      result[size] = `/image/${size}${path}`
    }

    return result
  }

  public async movie(
    id: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBMovieDetails> {
    return this.get<TMDBMovieDetails>(`/movie/${id}`, buildDefaultParams(lang))
  }

  public async movieCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(
      `/movie/${id}/credits`,
      { language: lang }
    )
  }

  public async movieVideos(
    id: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(
      `/movie/${id}/videos`,
      { language: lang }
    )
  }

  public async tvShow(
    id: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBTVDetails> {
    return this.get<TMDBTVDetails>(`/tv/${id}`, buildDefaultParams(lang))
  }

  public async tvSeason(
    id: number,
    season: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBSeasonDetails> {
    return this.get<TMDBSeasonDetails>(`/tv/${id}/season/${season}`, {
      language: lang,
    })
  }

  public async tvEpisode(
    id: number,
    season: number,
    episode: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBEpisode> {
    return this.get<TMDBEpisode>(
      `/tv/${id}/season/${season}/episode/${episode}`,
      { language: lang }
    )
  }

  public async tvCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(
      `/tv/${id}/credits`,
      { language: lang }
    )
  }

  public async tvVideos(
    id: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(
      `/tv/${id}/videos`,
      { language: lang }
    )
  }

  public async tvExternalIds(
    id: number
  ): Promise<{ imdb_id: string | null; tvdb_id: number | null }> {
    return this.get<{ imdb_id: string | null; tvdb_id: number | null }>(
      `/tv/${id}/external_ids`
    )
  }

  public async searchMulti(
    query: string,
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMultiResult>> {
    const data = await this.get<TMDBPageResult<TMDBMultiResult>>(
      "/search/multi",
      buildDefaultParams(lang, { query, page: String(page) })
    )
    return filterMulti(data)
  }

  public async searchMovie(
    query: string,
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>(
      "/search/movie",
      buildDefaultParams(lang, { query, page: String(page) })
    )
    return filterMovies(data)
  }

  public async searchTV(
    query: string,
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>(
      "/search/tv",
      buildDefaultParams(lang, { query, page: String(page) })
    )
    return filterTV(data)
  }

  public async discoverMovie(
    params: TMDBDiscoverParams,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie>> {
    const requestParams: Record<string, string> = {
      ...buildDefaultParams(lang),
      "vote_count.gte": String(MIN_VOTE_COUNT),
    }

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) requestParams[key] = String(value)
    }

    const data = await this.get<TMDBPageResult<TMDBMovie>>(
      "/discover/movie",
      requestParams
    )
    return filterMovies(data)
  }

  public async discoverTV(
    params: TMDBDiscoverParams,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBTVShow>> {
    const requestParams: Record<string, string> = {
      ...buildDefaultParams(lang),
      "vote_count.gte": String(MIN_VOTE_COUNT),
    }

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) requestParams[key] = String(value)
    }

    const data = await this.get<TMDBPageResult<TMDBTVShow>>(
      "/discover/tv",
      requestParams
    )
    return filterTV(data)
  }

  public async popularMovies(
    page = 1,
    lang = DEFAULT_LANGUAGE,
    timeWindow: "day" | "week" = "week"
  ): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>(
      `/trending/movie/${timeWindow}`,
      buildDefaultParams(lang, { page: String(page) })
    )
    return filterMovies(data)
  }

  public async topRatedMovies(
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie>> {
    return this.discoverMovie(
      {
        page,
        sort_by: "vote_average.desc",
        "vote_count.gte": 1000,
      },
      lang
    )
  }

  public async upcomingMovies(
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>(
      "/movie/upcoming",
      buildDefaultParams(lang, { page: String(page) })
    )
    return filterMovies(data)
  }

  public async popularTV(
    page = 1,
    lang = DEFAULT_LANGUAGE,
    timeWindow: "day" | "week" = "week"
  ): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>(
      `/trending/tv/${timeWindow}`,
      buildDefaultParams(lang, { page: String(page) })
    )
    return filterTV(data)
  }

  public async topRatedTV(
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBTVShow>> {
    return this.discoverTV(
      {
        page,
        sort_by: "vote_average.desc",
        "vote_count.gte": 500,
      },
      lang
    )
  }

  public async movieGenres(
    lang = DEFAULT_LANGUAGE
  ): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/movie/list", {
      language: lang,
    })
  }

  public async tvGenres(
    lang = DEFAULT_LANGUAGE
  ): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/tv/list", {
      language: lang,
    })
  }

  public async recommendations(
    type: "movie" | "tv",
    id: number,
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(
      `/${type}/${id}/recommendations`,
      buildDefaultParams(lang, { page: String(page) })
    )

    if (type === "movie") {
      return filterMovies(data as TMDBPageResult<TMDBMovie>)
    }
    return filterTV(data as TMDBPageResult<TMDBTVShow>)
  }

  public async similar(
    type: "movie" | "tv",
    id: number,
    page = 1,
    lang = DEFAULT_LANGUAGE
  ): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(
      `/${type}/${id}/similar`,
      buildDefaultParams(lang, { page: String(page) })
    )

    if (type === "movie") {
      return filterMovies(data as TMDBPageResult<TMDBMovie>)
    }
    return filterTV(data as TMDBPageResult<TMDBTVShow>)
  }

  public async collection(
    id: number,
    lang = DEFAULT_LANGUAGE
  ): Promise<{
    id: number
    name: string
    overview: string
    poster_path: string | null
    backdrop_path: string | null
    parts: TMDBMovie[]
  }> {
    return this.get(`/collection/${id}`, { language: lang })
  }

  public async movieCertification(id: number): Promise<string | null> {
    try {
      const data = await this.get<{
        results: Array<{
          iso_3166_1: string
          release_dates: Array<{ certification: string }>
        }>
      }>(`/movie/${id}/release_dates`)

      const usRelease = data.results.find((item) => item.iso_3166_1 === "US")
      if (!usRelease) return null

      const cert = usRelease.release_dates.find((item) => item.certification)
      return cert?.certification ?? null
    } catch {
      return null
    }
  }

  public async tvCertification(id: number): Promise<string | null> {
    try {
      const data = await this.get<{
        results: Array<{ rating: string }>
      }>(`/tv/${id}/content_ratings`)

      const usRating = data.results.find((item) => item.rating)
      return usRating?.rating ?? null
    } catch {
      return null
    }
  }
}

export const tmdb = new TMDBClient()
