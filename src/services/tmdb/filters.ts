import type { TMDBMovie, TMDBMultiResult, TMDBPageResult, TMDBTVShow } from "../../types/tmdb"

export const MIN_VOTE_COUNT = 300

// Search: how many days after release we treat a title as "fresh". Fresh
// titles (new seasons/shows) are kept regardless of engagement, because
// vote counts start at zero on release day.
const FRESH_DAYS = 365

// Search: engagement floor for OLDER titles. Pilot films, one-off shorts and
// barely-known items (e.g. "Adventure Time" 2007 pilot, only watchable on
// YouTube) never reach it and get filtered from text search results.
const OLD_VOTE_FLOOR = 50
const OLD_POPULARITY_FLOOR = 3

export const BANNED_CERTIFICATIONS = new Set([
  "18",
  "18+",
  "R18",
  "R-18",
  "NC-17",
  "X",
  "XXX",
])

const ADULT_STRICT_PATTERNS = [
  /секс/i,
  /sex/i,
  /hentai/i,
  /хентай/i,
  /ecchi/i,
  /этти/i,
  /jav/i,
  /xxx/i,
  /brazzers/i,
  /softcore/i,
  /striptease/i,
  /porno/i,
  /порно/i,
  /эротик/i,
  /erotic/i,
]

const NON_LATIN_CYRILLIC_ONLY = /^[^\a-zA-Z\а-яА-Я0-9\s!?:;.,'"\-–—()]+$/

export function buildDefaultParams(
  lang: string,
  extraParams?: Record<string, string>
): Record<string, string> {
  return {
    language: lang,
    include_adult: "false",
    ...extraParams,
  }
}

function hasAdultContent(...texts: Array<string | undefined | null>): boolean {
  const combinedText = texts.filter(Boolean).join(" ")
  return ADULT_STRICT_PATTERNS.some((pattern) => pattern.test(combinedText))
}

function hasValidTitle(title?: string, originalTitle?: string): boolean {
  const primaryTitle = title || originalTitle
  if (!primaryTitle || primaryTitle.trim() === "") return false

  if (NON_LATIN_CYRILLIC_ONLY.test(primaryTitle.trim())) {
    return false
  }

  return true
}

interface ValidatableMovie {
  adult?: boolean
  certification?: string
  poster_path?: string | null
  poster?: string | null
  vote_average?: number
  voteAverage?: number
  popularity?: number
  release_date?: string
  releaseDate?: string
  overview?: string
  title?: string
  original_title?: string
  vote_count?: number
  voteCount?: number
  genre_ids?: number[]
  genres?: unknown[]
}

interface ValidatableTV {
  certification?: string
  poster_path?: string | null
  poster?: string | null
  vote_average?: number
  voteAverage?: number
  popularity?: number
  first_air_date?: string
  release_date?: string
  releaseDate?: string
  overview?: string
  name?: string
  title?: string
  original_name?: string
  originalTitle?: string
  vote_count?: number
  voteCount?: number
  genre_ids?: number[]
  genres?: unknown[]
}

function hasMinVotes(voteCount: number | undefined | null): boolean {
  return (voteCount ?? 0) >= MIN_VOTE_COUNT
}

// True when the release date is recent enough that a low vote count is
// expected (the title simply hasn't had time to accumulate engagement).
function isFresh(
  releaseDate: string | undefined | null,
  today: string,
): boolean {
  if (!releaseDate) return false
  const days = (Date.parse(today) - Date.parse(releaseDate)) / 86400000
  return days >= 0 && days <= FRESH_DAYS
}

// Engagement gate for search results that are NOT fresh. Old but strong
// titles pass; old weak ones (pilots, obscure one-offs) are dropped.
function hasSearchEngagement(
  voteCount: number | undefined | null,
  popularity: number | undefined,
): boolean {
  return (voteCount ?? 0) >= OLD_VOTE_FLOOR || (popularity ?? 0) >= OLD_POPULARITY_FLOOR
}

function hasGenres(genreIds: unknown[] | undefined, genres: unknown[] | undefined): boolean {
  const g = genreIds || genres
  return !!g && g.length > 0
}

export function validMovie(m: ValidatableMovie): boolean {
  if (m.adult) return false
  if (m.certification && BANNED_CERTIFICATIONS.has(String(m.certification))) return false
  if (!m.poster_path && !m.poster) return false
  if (!m.vote_average && !m.voteAverage) return false

  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = m.release_date || m.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!m.overview?.trim()) return false
  if (!hasValidTitle(m.title, m.original_title)) return false
  if (!hasMinVotes(m.vote_count ?? m.voteCount)) return false
  if (!hasGenres(m.genre_ids, m.genres)) return false

  return !hasAdultContent(m.title, m.original_title, m.overview)
}

export function validTV(t: ValidatableTV): boolean {
  if (t.certification && BANNED_CERTIFICATIONS.has(String(t.certification))) return false
  if (!t.poster_path && !t.poster) return false
  if (!t.vote_average && !t.voteAverage) return false

  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = t.first_air_date || t.release_date || t.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!t.overview?.trim()) return false
  if (!hasValidTitle(t.name || t.title, t.original_name || t.originalTitle)) return false
  if (!hasMinVotes(t.vote_count ?? t.voteCount)) return false
  if (!hasGenres(t.genre_ids, t.genres)) return false

  return !hasAdultContent(t.name, t.title, t.original_name, t.originalTitle, t.overview)
}

// Relaxed validators for text search — only hard requirements: poster, not adult, released.
// overview/vote_count/genres may be missing when TMDB returns results without language.
// Fresh titles are always kept; older titles must show some engagement so
// pilots/shorts/one-offs (e.g. "Adventure Time" 2007) don't pollute results.
export function validMovieSearch(m: ValidatableMovie): boolean {
  if (m.adult) return false
  if (!m.poster_path && !m.poster) return false
  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = m.release_date || m.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!isFresh(releaseDate, today) && !hasSearchEngagement(m.vote_count ?? m.voteCount, m.popularity)) return false
  if (hasAdultContent(m.title, m.original_title, m.overview)) return false
  return true
}

export function validTVSearch(t: ValidatableTV): boolean {
  if (!t.poster_path && !t.poster) return false
  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = t.first_air_date || t.release_date || t.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!isFresh(releaseDate, today) && !hasSearchEngagement(t.vote_count ?? t.voteCount, t.popularity)) return false
  if (hasAdultContent(t.name, t.title, t.original_name, t.originalTitle, t.overview)) return false
  return true
}

// Validators for filmography / related-by-cast credits. Same strictness as the
// list validators (poster, overview, genres, valid title, released, adult) but
// with the softer engagement floor of search: fresh titles are always kept and
// older titles only need 50 votes or a bit of popularity, so new and
// little-known releases aren't dropped.
export function validMovieCredit(m: ValidatableMovie): boolean {
  if (m.adult) return false
  if (m.certification && BANNED_CERTIFICATIONS.has(String(m.certification))) return false
  if (!m.poster_path && !m.poster) return false
  if (!m.vote_average && !m.voteAverage) return false

  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = m.release_date || m.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!m.overview?.trim()) return false
  if (!hasValidTitle(m.title, m.original_title)) return false
  if (!isFresh(releaseDate, today) && !hasSearchEngagement(m.vote_count ?? m.voteCount, m.popularity)) return false
  if (!hasGenres(m.genre_ids, m.genres)) return false

  return !hasAdultContent(m.title, m.original_title, m.overview)
}

export function validTVCredit(t: ValidatableTV): boolean {
  if (t.certification && BANNED_CERTIFICATIONS.has(String(t.certification))) return false
  if (!t.poster_path && !t.poster) return false
  if (!t.vote_average && !t.voteAverage) return false

  const today = new Date().toISOString().slice(0, 10)
  const releaseDate = t.first_air_date || t.release_date || t.releaseDate
  if (!releaseDate || releaseDate > today) return false
  if (!t.overview?.trim()) return false
  if (!hasValidTitle(t.name || t.title, t.original_name || t.originalTitle)) return false
  if (!isFresh(releaseDate, today) && !hasSearchEngagement(t.vote_count ?? t.voteCount, t.popularity)) return false
  if (!hasGenres(t.genre_ids, t.genres)) return false

  return !hasAdultContent(t.name, t.title, t.original_name, t.originalTitle, t.overview)
}

export function filterMovies(
  data: TMDBPageResult<TMDBMovie>
): TMDBPageResult<TMDBMovie> {
  return { ...data, results: data.results.filter(validMovie) }
}

export function filterTV(
  data: TMDBPageResult<TMDBTVShow>
): TMDBPageResult<TMDBTVShow> {
  return { ...data, results: data.results.filter(validTV) }
}

export function filterMoviesSearch(
  data: TMDBPageResult<TMDBMovie>
): TMDBPageResult<TMDBMovie> {
  return { ...data, results: data.results.filter(validMovieSearch) }
}

export function filterTVSearch(
  data: TMDBPageResult<TMDBTVShow>
): TMDBPageResult<TMDBTVShow> {
  return { ...data, results: data.results.filter(validTVSearch) }
}

export function filterMulti(
  data: TMDBPageResult<TMDBMultiResult>
): TMDBPageResult<TMDBMultiResult> {
  return {
    ...data,
    results: data.results.filter((item) => {
      if (item.media_type === "movie") return validMovie(item)
      if (item.media_type === "tv") return validTV(item)
      return true
    }),
  }
}

export function filterMultiSearch(
  data: TMDBPageResult<TMDBMultiResult>
): TMDBPageResult<TMDBMultiResult> {
  return {
    ...data,
    results: data.results.filter((item) => {
      if (item.media_type === "movie") return validMovieSearch(item)
      if (item.media_type === "tv") return validTVSearch(item)
      return true
    }),
  }
}
