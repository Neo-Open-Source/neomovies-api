export const typeDefs = /* GraphQL */ `
  enum MediaType {
    movie
    tv
  }

  enum PlayerProvider {
    alloha
    collaps
    cdn
  }

  enum MovieList {
    popular
    top_rated
    upcoming
  }

  enum TVList {
    popular
    top_rated
  }

  enum SearchType {
    movie
    tv
    multi
  }

  type Query {
    health: Health!

    media(type: MediaType!, id: Int!, language: String): MediaDetail
    mediaCredits(type: MediaType!, id: Int!, language: String): Credits
    recommendations(type: MediaType!, id: Int!, page: Int, language: String): PaginatedMedia!
    similar(type: MediaType!, id: Int!, page: Int, language: String): PaginatedMedia!
    relatedByCast(type: MediaType!, id: Int!, page: Int, language: String): PaginatedMedia!
    relatedByStudio(type: MediaType!, id: Int!, page: Int, language: String): PaginatedMediaWithLabel!
    mediaCollection(id: Int!, language: String): Collection
    season(tvId: Int!, season: Int!, language: String): SeasonDetail
    episode(tvId: Int!, season: Int!, episode: Int!, language: String): Episode

    movieList(list: MovieList!, page: Int, language: String): PaginatedMedia!
    tvList(list: TVList!, page: Int, language: String): PaginatedMedia!
    trending(type: MediaType, page: Int, language: String): PaginatedTrending!

    search(
      q: String, type: SearchType, genre: String, year: Int,
      yearFrom: Int, yearTo: Int, rating: Float,
      ratingFrom: Float, ratingTo: Float, keyword: String,
      country: String, sortBy: String, page: Int, language: String
    ): PaginatedSearch!

    genres(language: String): Genres!

    person(id: Int!, language: String): Person
    personCredits(id: Int!, page: Int, language: String): PaginatedPersonCredit!

    categories(language: String): [CategorySection!]!
    categoryCollection(slug: String!, page: Int, language: String): CategoryCollection!

    player(provider: PlayerProvider!, kpId: Int, tmdbId: Int, imdbId: String, season: Int, episode: Int): PlayerResult!
    cdnPlayer(cdnId: Int, kpId: Int, imdbId: String, season: Int, episode: Int): CdnPlayerResult!

    favorites(page: Int, language: String): PaginatedFavorite!
    watchLater: [WatchLaterItem!]!
    syncProgress: [SyncProgressItem!]!

    me: AuthUser!
    loginUrl(
      redirectUri: String
      codeChallenge: String
      codeChallengeMethod: String
      state: String
    ): String!

    torrentSearch(q: String, imdbId: String): [Torrent!]!
    supporters: [Supporter!]!
  }

  type Mutation {
    refreshTokens(refreshToken: String!): AuthTokens!
    updateProfile(name: String, avatar: String): AuthUser!
    logout: Boolean!
    deleteAccount: Boolean!

    addFavorite(mediaId: Int!, mediaType: MediaType = movie): Favorite!
    removeFavorite(mediaId: Int!, mediaType: MediaType = movie): Boolean!

    addToWatchLater(mediaId: Int!): WatchLaterItem!
    removeFromWatchLater(mediaId: Int!): Boolean!

    upsertProgress(mediaId: Int!, mediaType: MediaType = movie, season: Int, episode: Int, progress: Float!): SyncProgressItem!
    deleteProgress(mediaId: Int!, mediaType: MediaType = movie, season: Int, episode: Int): Boolean!
    batchSyncProgress(items: [SyncProgressInput!]!): BatchSyncResult!
  }

  type Health {
    status: String!
    version: String!
    timestamp: String!
  }

  type AuthTokens {
    accessToken: String!
    refreshToken: String!
    idToken: String
    expiresIn: Int!
  }

  type AuthUser {
    id: String!
    email: String
    displayName: String
    avatar: String
    role: String
  }

  type Genre {
    id: Int!
    name: String!
  }

  type Genres {
    movie: [Genre!]!
    tv: [Genre!]!
  }

  interface MediaFields {
    certification: String
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    imdbRating: Float
  }

  type MediaItem implements MediaFields {
    certification: String
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    imdbRating: Float
  }

  type PaginatedMedia {
    items: [MediaItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  type PaginatedTrending {
    items: [TrendingItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  type TrendingItem {
    certification: String
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    imdbRating: Float
    mediaType: MediaType!
  }

  union MediaDetail = MovieDetail | TVDetail

  type MovieDetail {
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    logo: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    certification: String
    imdbId: String
    kpId: Int
    imdbRating: Float
    imdbVotes: Int
    runtime: Int
    budget: Float
    revenue: Float
    status: String
    tagline: String
    productionCompanies: [Company!]!
    collection: CollectionSummary
    trailers: [String!]!
    credits: Credits!
  }

  type TVDetail {
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    logo: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    certification: String
    imdbId: String
    kpId: Int
    imdbRating: Float
    imdbVotes: Int
    seasons: [SeasonSummary!]!
    numberOfSeasons: Int!
    numberOfEpisodes: Int!
    status: String
    tagline: String
    networks: [Company!]!
    productionCompanies: [Company!]!
    trailers: [String!]!
    credits: Credits!
  }

  type Company {
    id: Int!
    name: String!
    logo: String
  }

  type CollectionSummary {
    id: Int!
    name: String!
    poster: String
  }

  type Collection {
    id: Int!
    name: String!
    overview: String
    poster: String
    backdrop: String
    parts: [MediaItem!]
  }

  type Credits {
    cast: [CastMember!]!
    crew: [CrewMember!]!
  }

  type CastMember {
    id: Int!
    name: String!
    character: String
    profile: String
    order: Int
  }

  type CrewMember {
    id: Int!
    name: String!
    job: String!
    department: String!
    profile: String
  }

  type SeasonSummary {
    id: Int!
    name: String!
    seasonNumber: Int!
    episodeCount: Int!
    overview: String
    poster: String
    airDate: String
  }

  type SeasonDetail {
    id: Int!
    name: String!
    seasonNumber: Int!
    overview: String
    poster: String
    airDate: String
    episodes: [Episode!]!
  }

  type Episode {
    id: Int!
    name: String!
    overview: String
    still: String
    airDate: String
    episodeNumber: Int!
    seasonNumber: Int!
    voteAverage: Float!
    runtime: Int
  }

  type PaginatedMediaWithLabel {
    items: [MediaItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
    label: String
  }

  type PaginatedSearch {
    items: [SearchItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  union SearchItem = MediaItem | PersonSearchItem

  type PersonSearchItem {
    mediaType: String!
    tmdbId: Int!
    name: String!
    profile: String
    department: String
  }

  type Person {
    tmdbId: Int!
    name: String!
    profile: String
    department: String
  }

  type PaginatedPersonCredit {
    items: [PersonCreditItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  type PersonCreditItem {
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String
    poster: String
    releaseDate: String
    voteAverage: Float
    voteCount: Int
    popularity: Float
    mediaType: MediaType!
    role: String
    creditType: String!
  }

  type CategorySection {
    section: String!
    items: [CategoryItem!]!
  }

  type CategoryItem {
    id: String!
    name: String!
    slug: String!
    type: MediaType
    backdrop: String
  }

  type CategoryCollection {
    category: CategoryMeta!
    items: [MediaItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  type CategoryMeta {
    id: String!
    name: String!
    slug: String!
  }

  type PlayerResult {
    provider: String!
    url: String!
    type: String!
  }

  type CdnPlayerResult {
    provider: String!
    id: String!
    title: String!
    isSeries: Boolean!
    m3u8Url: String!
    season: Int
    episode: Int
    episodes: [CdnEpisode!]!
  }

  type CdnEpisode {
    season: Int!
    episode: Int!
    title: String!
    m3u8Url: String!
  }

  type Favorite {
    id: String!
    mediaId: Int!
    mediaType: MediaType!
    createdAt: String!
  }

  type PaginatedFavorite {
    items: [FavoriteMediaItem!]!
    page: Int!
    totalPages: Int!
    totalResults: Int!
  }

  type FavoriteMediaItem implements MediaFields {
    certification: String
    tmdbId: Int!
    title: String!
    originalTitle: String!
    overview: String!
    poster: String
    backdrop: String
    releaseDate: String
    genres: [Genre!]
    voteAverage: Float!
    voteCount: Int!
    popularity: Float!
    imdbRating: Float
    mediaId: Int!
    mediaType: MediaType!
    createdAt: String!
  }

  type WatchLaterItem {
    mediaId: Int!
    createdAt: String!
  }

  type SyncProgressItem {
    mediaId: Int!
    mediaType: MediaType!
    season: Int
    episode: Int
    progress: Float!
    updatedAt: String!
    title: String
    poster: String
    backdrop: String
    episodeName: String
    episodeStill: String
  }

  input SyncProgressInput {
    mediaId: Int!
    mediaType: MediaType = movie
    season: Int
    episode: Int
    progress: Float!
  }

  type BatchSyncResult {
    items: [SyncProgressItem!]!
    count: Int!
  }

  type Torrent {
    title: String!
    seeders: Int!
    leechers: Int!
    size: Float!
    magnet: String!
    quality: String!
    type: String!
  }

  type Supporter {
    id: Int!
    name: String!
    type: [String!]!
    description: String!
    contributions: [String!]!
    year: Int!
    isActive: Boolean!
  }
`
