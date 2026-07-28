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

function baseParams(extra?: Record<string, string>): Record<string, string> {
  return { language: "ru-RU", include_adult: "false", ...extra }
}

function validMovie(m: TMDBMovie): boolean {
  const today = new Date()
  if (m.adult) return false
  if (!m.poster_path) return false
  if (!m.vote_average || m.vote_average === 0) return false
  if (!m.release_date || m.release_date > today.toISOString().slice(0, 10)) return false
  return true
}

function validTV(t: TMDBTVShow): boolean {
  const today = new Date()
  if (!t.poster_path) return false
  if (!t.vote_average || t.vote_average === 0) return false
  if (!t.first_air_date || t.first_air_date > today.toISOString().slice(0, 10)) return false
  return true
}

function filterMovies(data: TMDBPageResult<TMDBMovie>): TMDBPageResult<TMDBMovie> {
  return { ...data, results: data.results.filter(validMovie) }
}

function filterTV(data: TMDBPageResult<TMDBTVShow>): TMDBPageResult<TMDBTVShow> {
  return { ...data, results: data.results.filter(validTV) }
}

function filterMulti(data: TMDBPageResult<TMDBMultiResult>): TMDBPageResult<TMDBMultiResult> {
  return {
    ...data,
    results: data.results.filter((item) => {
      if (item.media_type === "movie") return validMovie(item as unknown as TMDBMovie)
      if (item.media_type === "tv") return validTV(item as unknown as TMDBTVShow)
      return true
    }),
  }
}

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

  imageSizes(path: string | null, sizes: readonly string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {}
    if (!path) {
      for (const s of sizes) result[s] = null
      return result
    }
    for (const s of sizes) result[s] = `${config.tmdb.imageBaseUrl}/${s}${path}`
    return result
  }

  async movie(id: number): Promise<TMDBMovieDetails> {
    return this.get<TMDBMovieDetails>(`/movie/${id}`, baseParams())
  }

  async movieCredits(id: number) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(`/movie/${id}/credits`, { language: "ru-RU" })
  }

  async movieVideos(id: number): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(`/movie/${id}/videos`, { language: "ru-RU" })
  }

  async tvShow(id: number): Promise<TMDBTVDetails> {
    return this.get<TMDBTVDetails>(`/tv/${id}`, baseParams())
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

  async tvExternalIds(id: number): Promise<{ imdb_id: string | null; tvdb_id: number | null }> {
    return this.get<{ imdb_id: string | null; tvdb_id: number | null }>(`/tv/${id}/external_ids`)
  }

  async searchMulti(query: string, page: number = 1): Promise<TMDBPageResult<TMDBMultiResult>> {
    const data = await this.get<TMDBPageResult<TMDBMultiResult>>("/search/multi", baseParams({ query, page: String(page) }))
    return filterMulti(data)
  }

  async searchMovie(query: string, page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/search/movie", baseParams({ query, page: String(page) }))
    return filterMovies(data)
  }

  async searchTV(query: string, page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>("/search/tv", baseParams({ query, page: String(page) }))
    return filterTV(data)
  }

  async discoverMovie(params: TMDBDiscoverParams): Promise<TMDBPageResult<TMDBMovie>> {
    const strParams: Record<string, string> = { ...baseParams(), "vote_count.gte": "10" }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) strParams[k] = String(v)
    }
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/discover/movie", strParams)
    return filterMovies(data)
  }

  async discoverTV(params: TMDBDiscoverParams): Promise<TMDBPageResult<TMDBTVShow>> {
    const strParams: Record<string, string> = { ...baseParams(), "vote_count.gte": "10" }
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) strParams[k] = String(v)
    }
    const data = await this.get<TMDBPageResult<TMDBTVShow>>("/discover/tv", strParams)
    return filterTV(data)
  }

  async popularMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/movie/popular", baseParams({ page: String(page), "vote_count.gte": "50" }))
    return filterMovies(data)
  }

  async topRatedMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/movie/top_rated", baseParams({ page: String(page), "vote_count.gte": "50" }))
    return filterMovies(data)
  }

  async upcomingMovies(page: number = 1): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/movie/upcoming", baseParams({ page: String(page) }))
    return filterMovies(data)
  }

  async popularTV(page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>("/tv/popular", baseParams({ page: String(page), "vote_count.gte": "10" }))
    return filterTV(data)
  }

  async topRatedTV(page: number = 1): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>("/tv/top_rated", baseParams({ page: String(page), "vote_count.gte": "10" }))
    return filterTV(data)
  }

  async movieGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/movie/list", { language: "ru-RU" })
  }

  async tvGenres(): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/tv/list", { language: "ru-RU" })
  }

  async recommendations(type: "movie" | "tv", id: number, page: number = 1): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/recommendations`, baseParams({ page: String(page) }))
    if (type === "movie") return filterMovies(data as TMDBPageResult<TMDBMovie>) as TMDBPageResult<TMDBMovie | TMDBTVShow>
    return filterTV(data as TMDBPageResult<TMDBTVShow>) as TMDBPageResult<TMDBMovie | TMDBTVShow>
  }

  async similar(type: "movie" | "tv", id: number, page: number = 1): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/similar`, baseParams({ page: String(page) }))
    if (type === "movie") return filterMovies(data as TMDBPageResult<TMDBMovie>) as TMDBPageResult<TMDBMovie | TMDBTVShow>
    return filterTV(data as TMDBPageResult<TMDBTVShow>) as TMDBPageResult<TMDBMovie | TMDBTVShow>
  }

  async collection(id: number): Promise<{ id: number; name: string; overview: string; poster_path: string | null; backdrop_path: string | null; parts: TMDBMovie[] }> {
    return this.get(`/collection/${id}`, { language: "ru-RU" })
  }
}

export const tmdb = new TMDBClient()
