import { tmdb } from "../services/tmdb"
import * as images from "./images"
import type { TMDBMovie, TMDBTVShow, TMDBMovieDetails, TMDBTVDetails } from "../types/tmdb"

export function mapMovie(m: TMDBMovie | TMDBMovieDetails) {
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
    genres: (m as any).genres?.map((g: any) => ({ id: g.id, name: g.name })) ?? null,
    genreIds: (m as TMDBMovie).genre_ids ?? null,
    voteAverage: m.vote_average,
    voteCount: m.vote_count,
    popularity: m.popularity,
  }
}

export function mapTV(t: TMDBTVShow | TMDBTVDetails) {
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
    genres: (t as any).genres?.map((g: any) => ({ id: g.id, name: g.name })) ?? null,
    genreIds: (t as TMDBTVShow).genre_ids ?? null,
    voteAverage: t.vote_average,
    voteCount: t.vote_count,
    popularity: t.popularity,
  }
}

export function mapCastMember(c: any) {
  return {
    id: c.id,
    name: c.name,
    character: c.character,
    profile: tmdb.imageUrl(c.profile_path, "w185"),
    profiles: tmdb.imageSizes(c.profile_path, images.PROFILE_SIZES),
    order: c.order,
  }
}

export function mapCrewMember(c: any) {
  return {
    id: c.id,
    name: c.name,
    job: c.job,
    department: c.department,
    profile: tmdb.imageUrl(c.profile_path, "w185"),
    profiles: tmdb.imageSizes(c.profile_path, images.PROFILE_SIZES),
  }
}

export function mapCompany(c: any) {
  return {
    id: c.id,
    name: c.name,
    logo: tmdb.imageUrl(c.logo_path, "w92"),
    logos: tmdb.imageSizes(c.logo_path, images.LOGO_SIZES),
  }
}

export function mapSeason(s: any) {
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

export function mapEpisode(e: any) {
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

export function mapNetwork(n: any) {
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
