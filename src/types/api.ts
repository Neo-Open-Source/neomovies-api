export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  totalPages: number
  totalResults: number
}

export interface MediaResponse {
  id: number
  title: string
  originalTitle: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  genres: { id: number; name: string }[]
  voteAverage: number
  voteCount: number
}

export interface MovieDetailsResponse extends MediaResponse {
  runtime: number | null
  budget: number
  revenue: number
  status: string
  tagline: string
  imdbId: string | null
  productionCompanies: { id: number; name: string; logoPath: string | null }[]
  collection: { id: number; name: string; posterPath: string | null } | null
  videos: { key: string; name: string; site: string; type: string }[]
  credits: CreditsResponse
}

export interface TVDetailsResponse extends MediaResponse {
  seasons: SeasonSummary[]
  numberOfSeasons: number
  numberOfEpisodes: number
  status: string
  networks: { id: number; name: string; logoPath: string | null }[]
  videos: { key: string; name: string; site: string; type: string }[]
  credits: CreditsResponse
}

export interface SeasonSummary {
  id: number
  name: string
  seasonNumber: number
  episodeCount: number
  overview: string
  posterPath: string | null
  airDate: string | null
}

export interface EpisodeResponse {
  id: number
  name: string
  overview: string
  stillPath: string | null
  airDate: string | null
  episodeNumber: number
  seasonNumber: number
  voteAverage: number
  runtime: number | null
}

export interface CreditsResponse {
  cast: CastMember[]
  crew: CrewMember[]
}

export interface CastMember {
  id: number
  name: string
  character: string
  profilePath: string | null
  order: number
}

export interface CrewMember {
  id: number
  name: string
  job: string
  department: string
  profilePath: string | null
}

export interface GenreResponse {
  id: number
  name: string
}

export interface PlayerResponse {
  provider: string
  url: string
  type: "iframe" | "hls" | "mp4"
}

export interface UserProfile {
  id: string
  neoId: string
  email: string | null
  username: string | null
  avatarUrl: string | null
  createdAt: Date
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SyncProgressDTO {
  mediaId: number
  mediaType: string
  season?: number
  episode?: number
  progress: number
}
