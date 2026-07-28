export interface TMDBPageResult<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
  popularity: number
  adult: boolean
  original_language: string
  video: boolean
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  genre_ids: number[]
  vote_average: number
  vote_count: number
  popularity: number
  origin_country: string[]
  original_language: string
}

export interface TMDBPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string
  popularity: number
}

export type TMDBMultiResult =
  | ({ media_type: "movie" } & TMDBMovie)
  | ({ media_type: "tv" } & TMDBTVShow)
  | ({ media_type: "person" } & TMDBPerson)

export interface TMDBGenre {
  id: number
  name: string
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: TMDBGenre[]
  runtime: number | null
  budget: number
  revenue: number
  status: string
  tagline: string
  homepage: string | null
  imdb_id: string | null
  production_companies: TMDBCompany[]
  production_countries: TMDBCountry[]
  spoken_languages: TMDBSpokenLanguage[]
  belongs_to_collection: TMDBCollection | null
}

export interface TMDBTVDetails extends TMDBTVShow {
  genres: TMDBGenre[]
  seasons: TMDBSeason[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  tagline: string
  type: string
  homepage: string | null
  in_production: boolean
  last_air_date: string | null
  networks: TMDBNetwork[]
  production_companies: TMDBCompany[]
}

export interface TMDBSeason {
  id: number
  name: string
  season_number: number
  episode_count: number
  overview: string
  poster_path: string | null
  air_date: string | null
}

export interface TMDBEpisode {
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

export interface TMDBSeasonDetails {
  id: number
  name: string
  season_number: number
  episodes: TMDBEpisode[]
  overview: string
  poster_path: string | null
  air_date: string | null
}

export interface TMDBCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDBCollection {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
}

export interface TMDBCountry {
  iso_3166_1: string
  name: string
}

export interface TMDBNetwork {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDBSpokenLanguage {
  iso_639_1: string
  name: string
  english_name: string
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export interface TMDBDiscoverParams {
  with_genres?: string
  with_original_language?: string
  "vote_count.gte"?: number
  "vote_average.gte"?: number | string
  "vote_average.lte"?: number | string
  "primary_release_date.gte"?: string
  "primary_release_date.lte"?: string
  "first_air_date_year"?: number
  sort_by?: string
  page?: number
  with_keywords?: string
  with_companies?: string
}
