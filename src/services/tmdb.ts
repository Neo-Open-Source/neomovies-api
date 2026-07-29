import { config } from "../config"
import { DEFAULT_LANGUAGE } from "../lib/language"
import type {
  TMDBPageResult, TMDBMovie, TMDBTVShow, TMDBMultiResult,
  TMDBMovieDetails, TMDBTVDetails, TMDBSeasonDetails,
  TMDBEpisode, TMDBGenre, TMDBVideo, TMDBDiscoverParams,
} from "../types/tmdb"

function params(lang: string, extra?: Record<string, string>): Record<string, string> {
  return { language: lang, include_adult: "false", ...extra }
}

const adultKeywords = ["hentai", "секс", "porn", "эротик", "sex ", "xxx", "18+", "adult"]

function hasAdultContent(title: string, overview: string): boolean {
  const text = `${title} ${overview}`.toLowerCase()
  return adultKeywords.some(k => text.includes(k))
}

function validMovie(m: TMDBMovie): boolean {
  const today = new Date()
  if (m.adult) return false
  if (!m.poster_path) return false
  if (!m.vote_average || m.vote_average === 0) return false
  if (!m.release_date || m.release_date > today.toISOString().slice(0, 10)) return false
  if (!m.overview || m.overview.trim() === "") return false
  if (hasAdultContent(m.title, m.overview)) return false
  return true
}

function validTV(t: TMDBTVShow): boolean {
  const today = new Date()
  if (!t.poster_path) return false
  if (!t.vote_average || t.vote_average === 0) return false
  if (!t.first_air_date || t.first_air_date > today.toISOString().slice(0, 10)) return false
  if (!t.overview || t.overview.trim() === "") return false
  if (hasAdultContent(t.name, t.overview)) return false
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

  async get<T>(path: string, p?: Record<string, string>): Promise<T> {
    const key = this.cacheKey(path, p)
    const cached = this.cache.get<T>(key)
    if (cached) return cached

    const url = new URL(`${this.baseUrl}${path}`)
    if (p) Object.entries(p).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), { headers: this.headers })
    if (!res.ok) throw new Error(`TMDB API error: ${res.status} ${res.statusText}`)

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
    if (!path) { for (const s of sizes) result[s] = null; return result }
    for (const s of sizes) result[s] = `${config.tmdb.imageBaseUrl}/${s}${path}`
    return result
  }

  async movie(id: number, lang = DEFAULT_LANGUAGE): Promise<TMDBMovieDetails> {
    return this.get<TMDBMovieDetails>(`/movie/${id}`, params(lang))
  }

  async movieCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(`/movie/${id}/credits`, { language: lang })
  }

  async movieVideos(id: number, lang = DEFAULT_LANGUAGE): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(`/movie/${id}/videos`, { language: lang })
  }

  async tvShow(id: number, lang = DEFAULT_LANGUAGE): Promise<TMDBTVDetails> {
    return this.get<TMDBTVDetails>(`/tv/${id}`, params(lang))
  }

  async tvSeason(id: number, season: number, lang = DEFAULT_LANGUAGE): Promise<TMDBSeasonDetails> {
    return this.get<TMDBSeasonDetails>(`/tv/${id}/season/${season}`, { language: lang })
  }

  async tvEpisode(id: number, season: number, episode: number, lang = DEFAULT_LANGUAGE): Promise<TMDBEpisode> {
    return this.get<TMDBEpisode>(`/tv/${id}/season/${season}/episode/${episode}`, { language: lang })
  }

  async tvCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return this.get<{ cast: unknown[]; crew: unknown[] }>(`/tv/${id}/credits`, { language: lang })
  }

  async tvVideos(id: number, lang = DEFAULT_LANGUAGE): Promise<{ results: TMDBVideo[] }> {
    return this.get<{ results: TMDBVideo[] }>(`/tv/${id}/videos`, { language: lang })
  }

  async tvExternalIds(id: number): Promise<{ imdb_id: string | null; tvdb_id: number | null }> {
    return this.get<{ imdb_id: string | null; tvdb_id: number | null }>(`/tv/${id}/external_ids`)
  }

  async searchMulti(query: string, page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMultiResult>> {
    const data = await this.get<TMDBPageResult<TMDBMultiResult>>("/search/multi", params(lang, { query, page: String(page) }))
    return filterMulti(data)
  }

  async searchMovie(query: string, page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie>> {
    const data = await this.get<TMDBPageResult<TMDBMovie>>("/search/movie", params(lang, { query, page: String(page) }))
    return filterMovies(data)
  }

  async searchTV(query: string, page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBTVShow>>("/search/tv", params(lang, { query, page: String(page) }))
    return filterTV(data)
  }

  async discoverMovie(p: TMDBDiscoverParams, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie>> {
    const strParams: Record<string, string> = { ...params(lang), "vote_count.gte": "10" }
    for (const [k, v] of Object.entries(p)) if (v !== undefined) strParams[k] = String(v)
    return filterMovies(await this.get<TMDBPageResult<TMDBMovie>>("/discover/movie", strParams))
  }

  async discoverTV(p: TMDBDiscoverParams, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBTVShow>> {
    const strParams: Record<string, string> = { ...params(lang), "vote_count.gte": "10" }
    for (const [k, v] of Object.entries(p)) if (v !== undefined) strParams[k] = String(v)
    return filterTV(await this.get<TMDBPageResult<TMDBTVShow>>("/discover/tv", strParams))
  }

  async popularMovies(page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie>> {
    return filterMovies(await this.get<TMDBPageResult<TMDBMovie>>("/movie/popular", params(lang, { page: String(page), "vote_count.gte": "50" })))
  }

  async topRatedMovies(page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie>> {
    return filterMovies(await this.get<TMDBPageResult<TMDBMovie>>("/movie/top_rated", params(lang, { page: String(page), "vote_count.gte": "50" })))
  }

  async upcomingMovies(page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie>> {
    return filterMovies(await this.get<TMDBPageResult<TMDBMovie>>("/movie/upcoming", params(lang, { page: String(page) })))
  }

  async popularTV(page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBTVShow>> {
    return filterTV(await this.get<TMDBPageResult<TMDBTVShow>>("/tv/popular", params(lang, { page: String(page), "vote_count.gte": "50" })))
  }

  async topRatedTV(page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBTVShow>> {
    return filterTV(await this.get<TMDBPageResult<TMDBTVShow>>("/tv/top_rated", params(lang, { page: String(page), "vote_count.gte": "50" })))
  }

  async movieGenres(lang = DEFAULT_LANGUAGE): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/movie/list", { language: lang })
  }

  async tvGenres(lang = DEFAULT_LANGUAGE): Promise<{ genres: TMDBGenre[] }> {
    return this.get<{ genres: TMDBGenre[] }>("/genre/tv/list", { language: lang })
  }

  async recommendations(type: "movie" | "tv", id: number, page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/recommendations`, params(lang, { page: String(page) }))
    if (type === "movie") return filterMovies(data as any) as any
    return filterTV(data as any) as any
  }

  async similar(type: "movie" | "tv", id: number, page = 1, lang = DEFAULT_LANGUAGE): Promise<TMDBPageResult<TMDBMovie | TMDBTVShow>> {
    const data = await this.get<TMDBPageResult<TMDBMovie | TMDBTVShow>>(`/${type}/${id}/similar`, params(lang, { page: String(page) }))
    if (type === "movie") return filterMovies(data as any) as any
    return filterTV(data as any) as any
  }

  async collection(id: number, lang = DEFAULT_LANGUAGE): Promise<{ id: number; name: string; overview: string; poster_path: string | null; backdrop_path: string | null; parts: TMDBMovie[] }> {
    return this.get(`/collection/${id}`, { language: lang })
  }

  async movieCertification(id: number): Promise<string | null> {
    try {
      const data = await this.get<{ results: Array<{ iso_3166_1: string; release_dates: Array<{ certification: string }> }> }>(`/movie/${id}/release_dates`)
      const us = data.results.find(r => r.iso_3166_1 === "US")
      if (!us) return null
      const cert = us.release_dates.find(d => d.certification)
      return cert?.certification ?? null
    } catch { return null }
  }

  async tvCertification(id: number): Promise<string | null> {
    try {
      const data = await this.get<{ results: Array<{ rating: string }> }>(`/tv/${id}/content_ratings`)
      const us = data.results.find(r => r.rating)
      return us?.rating ?? null
    } catch { return null }
  }
}

export const tmdb = new TMDBClient()
