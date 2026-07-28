import { tmdb } from "../services/tmdb"
import * as images from "./images"
import type { TMDBMovie, TMDBTVShow, TMDBGenre } from "../types/tmdb"

interface TMDBMovieOrDetails extends TMDBMovie {
  genres?: TMDBGenre[]
  imdb_id?: string | null
}

interface TMDBTVOrDetails extends TMDBTVShow {
  genres?: TMDBGenre[]
}

interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

interface TMDBCompany {
  id: number
  name: string
  logo_path: string | null
}

interface TMDBSeason {
  id: number
  name: string
  season_number: number
  episode_count: number
  overview: string
  poster_path: string | null
  air_date: string | null
}

interface TMDBEpisode {
  id: number
  name: string
  overview: string
  still_path: string | null
  air_date: string | null
  episode_number: number
  season_number: number
  vote_average: number
  runtime: number | null
}

interface TMDBNetwork {
  id: number
  name: string
  logo_path: string | null
}

function parseGenres(m: TMDBMovieOrDetails | TMDBTVOrDetails): { id: number; name: string }[] | null {
  if (m.genres) return m.genres.map(g => ({ id: g.id, name: g.name }))
  if ("genre_ids" in m) return null
  return null
}

export function mapMovie(m: TMDBMovieOrDetails) {
  return {
    tmdbId: m.id,
    imdbId: "imdb_id" in m ? m.imdb_id ?? null : null,
    title: m.title,
    originalTitle: m.original_title,
    overview: m.overview,
    poster: tmdb.imageUrl(m.poster_path, "w500"),
    backdrop: tmdb.imageUrl(m.backdrop_path, "w1280"),
    posters: tmdb.imageSizes(m.poster_path, images.POSTER_SIZES),
    backdrops: tmdb.imageSizes(m.backdrop_path, images.BACKDROP_SIZES),
    releaseDate: m.release_date || null,
    genres: parseGenres(m),
    genreIds: "genre_ids" in m ? m.genre_ids : null,
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
    popularity: m.popularity,
  }
}

export function mapTV(t: TMDBTVOrDetails) {
  return {
    tmdbId: t.id,
    imdbId: null,
    title: t.name,
    originalTitle: t.original_name,
    overview: t.overview,
    poster: tmdb.imageUrl(t.poster_path, "w500"),
    backdrop: tmdb.imageUrl(t.backdrop_path, "w1280"),
    posters: tmdb.imageSizes(t.poster_path, images.POSTER_SIZES),
    backdrops: tmdb.imageSizes(t.backdrop_path, images.BACKDROP_SIZES),
    releaseDate: t.first_air_date || null,
    genres: parseGenres(t),
    genreIds: "genre_ids" in t ? t.genre_ids : null,
    voteAverage: t.vote_average,
    voteCount: t.vote_count,
    popularity: t.popularity,
  }
}

export function mapCastMember(c: TMDBCastMember) {
  return {
    id: c.id,
    name: c.name,
    character: c.character,
    profile: tmdb.imageUrl(c.profile_path, "w185"),
    profiles: tmdb.imageSizes(c.profile_path, images.PROFILE_SIZES),
    order: c.order,
  }
}

export function mapCrewMember(c: TMDBCrewMember) {
  return {
    id: c.id,
    name: c.name,
    job: c.job,
    department: c.department,
    profile: tmdb.imageUrl(c.profile_path, "w185"),
    profiles: tmdb.imageSizes(c.profile_path, images.PROFILE_SIZES),
  }
}

export function mapCompany(c: TMDBCompany) {
  return {
    id: c.id,
    name: c.name,
    logo: tmdb.imageUrl(c.logo_path, "w92"),
    logos: tmdb.imageSizes(c.logo_path, images.LOGO_SIZES),
  }
}

export function mapSeason(s: TMDBSeason) {
  return {
    id: s.id,
    name: s.name,
    seasonNumber: s.season_number,
    episodeCount: s.episode_count,
    overview: s.overview,
    poster: tmdb.imageUrl(s.poster_path, "w342"),
    posters: tmdb.imageSizes(s.poster_path, images.POSTER_SIZES),
    airDate: s.air_date,
  }
}

export function mapEpisode(e: TMDBEpisode) {
  return {
    id: e.id,
    name: e.name,
    overview: e.overview,
    still: tmdb.imageUrl(e.still_path, "w300"),
    stills: tmdb.imageSizes(e.still_path, images.STILL_SIZES),
    airDate: e.air_date,
    episodeNumber: e.episode_number,
    seasonNumber: e.season_number,
    voteAverage: e.vote_average,
    runtime: e.runtime,
  }
}

export function mapNetwork(n: TMDBNetwork) {
  return {
    id: n.id,
    name: n.name,
    logo: tmdb.imageUrl(n.logo_path, "w92"),
    logos: tmdb.imageSizes(n.logo_path, images.LOGO_SIZES),
  }
}

export function paginate<T>(items: T[], page: number, totalPages: number, totalResults: number) {
  return { items, page, totalPages, totalResults }
}
