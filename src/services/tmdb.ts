import { config } from "../config"
import type {
  TMDBPageResult,
  TMDBMovie,
  TMDBTVShow,
  TMDBMultiResult,
  TMDBMovieDetails,
  TMDBTVDetails,
  TMDBSeasonDetails,
  TMDBEpisode,
  TMDBGenre,
  TMDBVideo,
  TMDBDiscoverParams,
} from "../types/tmdb"

class TMDBCache {
  private store = new Map<string, { data: unknown; expires: number }>()
  private ttl = 5 * 60 * 1000

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry || Date.now() > entry.expires) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, { data, expires: Date.now() + this.ttl })
  }
}

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

  private cacheKey(path: string, params?: Record<string, string>): string {
    if (!params) return path
    const sorted = Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join("&")
    return `${path}?${sorted}`
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const key = this.cacheKey(path, params)

    const cached = this.cache.get<T>(key)
    if (cached) return cached

    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), { headers: this.headers })
    if (!res.ok) {
      throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json() as T
    this.cache.set(key, data)
    return data
  }

  imageUrl(path: string | null, size: string = "w500"): string | null {
    if (!path) return null
    return `${config.tmdb.imageBaseUrl}/${size}${path}`
  }

  async movie(id: number): Promise<TMDBMovieDetails> {
    return this.get<TMDBMovieDetails>(`/movie/${id}`, { language: "ru-RU" })
  }

  async movieCredits(id: number) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(`/movie/${id}/credits`, { language: "ru-RU" })
  }

  async movieVideos(id: number): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(`/movie/${id}/videos`, { language: "ru-RU" })
  }

  async tvShow(id: number): Promise<TMDBTVDetails> {
    return this.get<TMDBTVDetails>(`/tv/${id}`, { language: "ru-RU" })
  }

  async tvSeason(id: number, season: number): Promise<TMDBSeasonDetails> {
    return this.get<TMDBSeasonDetails>(`/tv/${id}/season/${season}`, { language: "ru-RU" })
  }

  async tvEpisode(id: number, season: number, episode: number): Promise<TMDBEpisode> {
    return this.get<TMDBEpisode>(`/tv/${id}/season/${season}/episode/${episode}`, { language: "ru-RU" })
  }

  async tvCredits(id: number) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(`/tv/${id}/credits`, { language: "ru-RU" })
  }

  async tvVideos(id: number): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(`/tv/${id}/videos`, { language: "ru-RU" })
  }

  async searchMulti(query: string, page: number = 1): Promise<TMDBPageResult<TMDBMultiResult>> {
    return this.get<TMDBPageResult<TMDBMultiResult>>("/search/multi", { query, page: String(page), language: "ru-RU" })
  }

  async searchMovie(query: string, page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    return this.get<TMDBPageResult<TMDBMovie>>("/search/movie", { query, page: String(page), language: "ru-RU" })
  }

  async searchTV(query: string, page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    return this.get<TMDBPageResult<TMDBTVShow>>("/search/tv", { query, page: String(page), language: "ru-RU" })
  }

  async discoverMovie(params: TMDBDiscoverParams): Promise<TMDBPageResult<TMDBMovie>> {
    const strParams: Record<string, string> = { language: "ru-RU" }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) strParams[k] = String(v)
    }
    return this.get<TMDBPageResult<TMDBMovie>>("/discover/movie", strParams)
  }

  async discoverTV(params: TMDBDiscoverParams): Promise<TMDBPageResult<TMDBTVShow>> {
    const strParams: Record<string, string> = { language: "ru-RU" }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) strParams[k] = String(v)
    }
    return this.get<TMDBPageResult<TMDBTVShow>>("/discover/tv", strParams)
  }

  async popularMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    return this.get<TMDBPageResult<TMDBMovie>>("/movie/popular", { page: String(page), language: "ru-RU" })
  }

  async topRatedMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    return this.get<TMDBPageResult<TMDBMovie>>("/movie/top_rated", { page: String(page), language: "ru-RU" })
  }

  async upcomingMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    return this.get<TMDBPageResult<TMDBMovie>>("/movie/upcoming", { page: String(page), language: "ru-RU" })
  }

  async popularTV(page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    return this.get<TMDBPageResult<TMDBTVShow>>("/tv/popular", { page: String(page), language: "ru-RU" })
  }

  async topRatedTV(page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    return this.get<TMDBPageResult<TMDBTVShow>>("/tv/top_rated", { page: String(page), language: "ru-RU" })
  }

  async movieGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/movie/list", { language: "ru-RU" })
  }

  async tvGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/tv/list", { language: "ru-RU" })
  }

  async recommendations(type: "movie" | "tv", id: number, page: number = 1): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    return this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/recommendations`, { page: String(page), language: "ru-RU" })
  }

  async similar(type: "movie" | "tv", id: number, page: number = 1): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    return this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/similar`, { page: String(page), language: "ru-RU" })
  }
}

export const tmdb = new TMDBClient()
