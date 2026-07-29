import { tmdb } from "./tmdb"
import { db } from "../db"
import { resolveIds } from "./alloha"
import { DEFAULT_LANGUAGE, type Language } from "../lib/language"
import {
  mapMovie, mapTV, mapCastMember, mapCrewMember, mapCompany,
  mapSeason, mapNetwork, mapEpisode, paginate,
} from "../lib/mappers"
import type {
  TMDBMultiResult, TMDBDiscoverParams, TMDBMovie,
} from "../types/tmdb"

interface TmdbCreditsResponse {
  cast: Array<{
    id: number; name: string; character: string;
    profile_path: string | null; order: number
  }>
  crew: Array<{
    id: number; name: string; job: string;
    department: string; profile_path: string | null
  }>
}

interface TmdbExternalIdsResponse {
  imdb_id: string | null
}

async function imdbRating(imdbId: string | null) {
  if (!imdbId) return { imdbRating: null, imdbVotes: null }
  const rows = await db.$queryRawUnsafe<Array<{ imdbRating: number | null; imdbVotes: number | null }>>(
    "SELECT \"imdbRating\", \"imdbVotes\" FROM \"MediaRating\" WHERE \"imdbId\" = $1", imdbId,
  )
  const rating = rows?.[0] ?? null
  return {
    imdbRating: rating ? Number(rating.imdbRating) : null,
    imdbVotes: rating?.imdbVotes ?? null,
  }
}

async function resolveExternalIds(
  tmdbId: number, mediaType: "movie" | "tv", tmdbImdbId: string | null,
): Promise<{ imdbId: string | null; kpId: number | null; imdbRating: number | null; imdbVotes: number | null }> {
  const ids = await resolveIds(tmdbId, mediaType)
  const imdbId = tmdbImdbId || ids.imdbId
  if (!imdbId) return { imdbId: null, kpId: ids.kpId, imdbRating: null, imdbVotes: null }
  const rating = await imdbRating(imdbId)
  return { imdbId, kpId: ids.kpId, ...rating }
}

function extractTrailers(videos: { results: Array<{ key: string; site: string; type: string; name: string; official: boolean }> }): string[] {
  return (videos.results || [])
    .filter(v => v.site === "YouTube" && v.type === "Trailer")
    .map(v => v.key)
}

function credits(c: TmdbCreditsResponse) {
  return {
    cast: (c.cast || []).slice(0, 20).map(mapCastMember),
    crew: (c.crew || []).slice(0, 20).map(mapCrewMember),
  }
}

const genreCache = new Map<string, Map<number, string>>()

async function genreNames(type: "movie" | "tv", lang: Language): Promise<Map<number, string>> {
  const key = `${type}:${lang}`
  let cached = genreCache.get(key)
  if (!cached) {
    const data = type === "movie" ? await tmdb.movieGenres(lang) : await tmdb.tvGenres(lang)
    cached = new Map(data.genres.map(g => [g.id, g.name]))
    genreCache.set(key, cached)
  }
  return cached
}

function enrichGenreNames(
  items: Array<{ tmdbId: number; genres: { id: number; name: string }[] | null }>,
  names: Map<number, string>,
  rawResults: Array<{ id: number; genre_ids?: number[] }>,
) {
  const rawMap = new Map(rawResults.filter(r => r.genre_ids?.length).map(r => [r.id, r.genre_ids!]))
  for (const item of items) {
    if (!item.genres) {
      const ids = rawMap.get(item.tmdbId)
      if (ids?.length) {
        item.genres = ids.map(id => ({ id, name: names.get(id) ?? String(id) }))
      }
    }
  }
}

async function enrichCertifications(items: Array<{ tmdbId: number; certification: string | null }>, type: "movie" | "tv") {
  const certs = await Promise.all(
    items.map(i => type === "movie" ? tmdb.movieCertification(i.tmdbId) : tmdb.tvCertification(i.tmdbId)),
  )
  items.forEach((i, idx) => { i.certification = certs[idx] })
}

export const media = {
  async movieDetail(id: number, lang = DEFAULT_LANGUAGE) {
    const [movie, c, certification, videos] = await Promise.all([
      tmdb.movie(id, lang),
      tmdb.movieCredits(id, lang),
      tmdb.movieCertification(id),
      tmdb.movieVideos(id, lang).catch(() => ({ results: [] })),
    ])
    const resolved = await resolveExternalIds(id, "movie", movie.imdb_id)
    return {
      ...mapMovie(movie),
      imdbId: resolved.imdbId,
      kpId: resolved.kpId,
      imdbRating: resolved.imdbRating,
      imdbVotes: resolved.imdbVotes,
      certification,
      trailers: extractTrailers(videos),
      runtime: movie.runtime,
      budget: movie.budget,
      revenue: movie.revenue,
      status: movie.status,
      tagline: movie.tagline,
      productionCompanies: (movie.production_companies || []).map(mapCompany),
      collection: movie.belongs_to_collection
        ? {
            id: movie.belongs_to_collection.id,
            name: movie.belongs_to_collection.name,
            poster: tmdb.imageUrl(movie.belongs_to_collection.poster_path, "w300"),
          }
        : null,
      credits: credits(c as unknown as TmdbCreditsResponse),
    }
  },

  async tvDetail(id: number, lang = DEFAULT_LANGUAGE) {
    const [show, c, certification, videos] = await Promise.all([
      tmdb.tvShow(id, lang),
      tmdb.tvCredits(id, lang),
      tmdb.tvCertification(id),
      tmdb.tvVideos(id, lang).catch(() => ({ results: [] })),
    ])
    const externalIds = await tmdb.tvExternalIds(id).catch(() => null)
    const tmdbImdbId = (externalIds as TmdbExternalIdsResponse | null)?.imdb_id ?? null
    const resolved = await resolveExternalIds(id, "tv", tmdbImdbId)
    return {
      ...mapTV(show),
      imdbId: resolved.imdbId,
      kpId: resolved.kpId,
      imdbRating: resolved.imdbRating,
      imdbVotes: resolved.imdbVotes,
      certification,
      trailers: extractTrailers(videos),
      seasons: (show.seasons || []).map(mapSeason),
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      status: show.status,
      tagline: show.tagline,
      networks: (show.networks || []).map(mapNetwork),
      productionCompanies: (show.production_companies || []).map(mapCompany),
      credits: credits(c as unknown as TmdbCreditsResponse),
    }
  },

  async movieCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return credits(await tmdb.movieCredits(id, lang) as unknown as TmdbCreditsResponse)
  },

  async tvCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return credits(await tmdb.tvCredits(id, lang) as unknown as TmdbCreditsResponse)
  },

  async episode(id: number, seasonNumber: number, episodeNumber: number, lang = DEFAULT_LANGUAGE) {
    return mapEpisode(await tmdb.tvEpisode(id, seasonNumber, episodeNumber, lang))
  },

  async season(id: number, seasonNumber: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.tvSeason(id, seasonNumber, lang)
    return {
      id: data.id,
      name: data.name,
      seasonNumber: data.season_number,
      overview: data.overview,
      poster: tmdb.imageUrl(data.poster_path, "w342"),
      airDate: data.air_date,
      episodes: (data.episodes || []).map(mapEpisode),
    }
  },

  async collection(id: number, lang = DEFAULT_LANGUAGE) {
    const movie = await tmdb.movie(id, lang)
    if (!movie.belongs_to_collection) return null

    const coll = await tmdb.collection(movie.belongs_to_collection.id, lang) as {
      id: number; name: string; overview: string;
      poster_path: string | null; backdrop_path: string | null;
      parts: TMDBMovie[]
    }
    const parts = (coll.parts || [])
      .filter((p) => p.id !== id)
      .sort((a, b) => (a.release_date || "").localeCompare(b.release_date || ""))
      .map(mapMovie)
    enrichGenreNames(parts, await genreNames("movie", lang), coll.parts)
    const certs = await Promise.all(parts.map(p => tmdb.movieCertification(p.tmdbId).catch(() => null)))
    parts.forEach((p, idx) => { p.certification = certs[idx] })

    return {
      id: coll.id,
      name: coll.name,
      overview: coll.overview,
      poster: tmdb.imageUrl(coll.poster_path, "w300"),
      backdrop: tmdb.imageUrl(coll.backdrop_path, "w1280"),
      parts,
    }
  },

  async list(type: "movie" | "tv", method: string, pageNum: number, lang = DEFAULT_LANGUAGE) {
    type Fetcher = (page: number, lang: Language) => Promise<{ results: any[]; page: number; total_pages: number; total_results: number }>
    const fetchers: Record<string, Fetcher> = {
      "movie:popular": tmdb.popularMovies.bind(tmdb) as Fetcher,
      "movie:top-rated": tmdb.topRatedMovies.bind(tmdb) as Fetcher,
      "movie:upcoming": tmdb.upcomingMovies.bind(tmdb) as Fetcher,
      "tv:popular": tmdb.popularTV.bind(tmdb) as Fetcher,
      "tv:top-rated": tmdb.topRatedTV.bind(tmdb) as Fetcher,
    }
    const mapper: (item: any) => any = type === "movie" ? mapMovie : mapTV
    const fetcher = fetchers[`${type}:${method}`]
    if (!fetcher) throw new Error(`Unknown list: ${type}/${method}`)

    const data = await fetcher(pageNum, lang)
    const items = data.results.map(mapper)
    enrichGenreNames(items, await genreNames(type, lang), data.results)
    await enrichCertifications(items, type)
    return paginate(items, data.page, data.total_pages, data.total_results)
  },

  async trending(method: string, pageNum: number, lang = DEFAULT_LANGUAGE, typeFilter?: "movie" | "tv") {
    const [movieData, tvData] = await Promise.all([
      typeFilter !== "tv" ? this.list("movie", method, pageNum, lang) : null,
      typeFilter !== "movie" ? this.list("tv", method, pageNum, lang) : null,
    ])

    if (typeFilter === "movie" || typeFilter === "tv") {
      const d = typeFilter === "movie" ? movieData : tvData
      return d!
    }

    const movieItems = (movieData?.items ?? []).map((i: any) => ({ ...i, mediaType: "movie" as const }))
    const tvItems = (tvData?.items ?? []).map((i: any) => ({ ...i, mediaType: "tv" as const }))

    const [movieCerts, tvCerts] = await Promise.all([
      Promise.all(movieItems.map(i => tmdb.movieCertification(i.tmdbId).catch(() => null))),
      Promise.all(tvItems.map(i => tmdb.tvCertification(i.tmdbId).catch(() => null))),
    ])
    movieItems.forEach((i, idx) => { i.certification = movieCerts[idx] })
    tvItems.forEach((i, idx) => { i.certification = tvCerts[idx] })

    const items: typeof movieItems = []
    const maxLen = Math.max(movieItems.length, tvItems.length)
    for (let i = 0; i < maxLen; i++) {
      if (i < movieItems.length) items.push(movieItems[i])
      if (i < tvItems.length) items.push(tvItems[i])
    }

    const totalResults = (movieData?.totalResults ?? 0) + (tvData?.totalResults ?? 0)
    const totalPages = Math.max(movieData?.totalPages ?? 0, tvData?.totalPages ?? 0)

    return { items, page: pageNum, totalPages, totalResults }
  },

  async similar(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.similar(type, id, pageNum, lang)
    const mapper: (item: any) => any = type === "movie" ? mapMovie : mapTV
    const items = data.results.map(mapper)
    enrichGenreNames(items, await genreNames(type, lang), data.results)
    await enrichCertifications(items, type)
    return paginate(items, data.page, data.total_pages, data.total_results)
  },

  async recommendations(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.recommendations(type, id, pageNum, lang)
    const mapper: (item: any) => any = type === "movie" ? mapMovie : mapTV
    const items = data.results.map(mapper)
    enrichGenreNames(items, await genreNames(type, lang), data.results)
    await enrichCertifications(items, type)
    return paginate(items, data.page, data.total_pages, data.total_results)
  },

  async search(p: Record<string, string | undefined>, lang = DEFAULT_LANGUAGE) {
    const { q, type, genre, year, yearFrom, yearTo, rating, ratingFrom, ratingTo, keyword, country, sort_by, page: pageStr } = p
    const pageNum = parseInt(pageStr || "1")

    if (q) {
      const mediaType = type || "multi"
      if (mediaType === "movie") {
        const data = await tmdb.searchMovie(q, pageNum, lang)
        const items = data.results.map(mapMovie)
        enrichGenreNames(items, await genreNames("movie", lang), data.results)
        await enrichCertifications(items, "movie")
        return paginate(items, data.page, data.total_pages, data.total_results)
      }
      if (mediaType === "tv") {
        const data = await tmdb.searchTV(q, pageNum, lang)
        const items = data.results.map(mapTV)
        enrichGenreNames(items, await genreNames("tv", lang), data.results)
        await enrichCertifications(items, "tv")
        return paginate(items, data.page, data.total_pages, data.total_results)
      }
      const data = await tmdb.searchMulti(q, pageNum, lang)
      const multiResult = data.results.map((item: TMDBMultiResult) => {
        if (item.media_type === "movie") return { ...mapMovie(item), mediaType: "movie" }
        if (item.media_type === "tv") return { ...mapTV(item), mediaType: "tv" }
        return {
          mediaType: "person", tmdbId: item.id, name: item.name,
          profile: tmdb.imageUrl(item.profile_path, "w185"),
          department: item.known_for_department,
        }
      })
      const movieItems = multiResult.filter(r => r.mediaType === "movie") as any[]
      const tvItems = multiResult.filter(r => r.mediaType === "tv") as any[]
      const movieRaw = data.results.filter((r: TMDBMultiResult) => r.media_type === "movie")
      const tvRaw = data.results.filter((r: TMDBMultiResult) => r.media_type === "tv")
      await Promise.all([
        movieItems.length ? enrichGenreNames(movieItems, await genreNames("movie", lang), movieRaw) : Promise.resolve(),
        tvItems.length ? enrichGenreNames(tvItems, await genreNames("tv", lang), tvRaw) : Promise.resolve(),
        movieItems.length ? enrichCertifications(movieItems, "movie") : Promise.resolve(),
        tvItems.length ? enrichCertifications(tvItems, "tv") : Promise.resolve(),
      ])
      return paginate(multiResult, data.page, data.total_pages, data.total_results)
    }

    const discover: Record<string, string> = {}
    if (genre) discover.with_genres = genre
    if (year) { discover["primary_release_date.gte"] = `${year}-01-01`; discover["primary_release_date.lte"] = `${year}-12-31` }
    if (yearFrom) discover["primary_release_date.gte"] = `${yearFrom}-01-01`
    if (yearTo) discover["primary_release_date.lte"] = `${yearTo}-12-31`
    if (rating) discover["vote_average.gte"] = rating
    if (ratingFrom) discover["vote_average.gte"] = ratingFrom
    if (ratingTo) discover["vote_average.lte"] = ratingTo
    if (keyword) discover.with_keywords = keyword
    if (country) discover.with_original_language = country
    if (pageStr) discover.page = pageStr
    discover.sort_by = sort_by || "popularity.desc"

    const searchMediaType = type || "movie"
    if (searchMediaType === "tv") {
      const data = await tmdb.discoverTV(discover as TMDBDiscoverParams, lang)
      const items = data.results.map(mapTV)
      enrichGenreNames(items, await genreNames("tv", lang), data.results)
      await enrichCertifications(items, "tv")
      return paginate(items, data.page, data.total_pages, data.total_results)
    }
    const data = await tmdb.discoverMovie(discover as TMDBDiscoverParams, lang)
    const items = data.results.map(mapMovie)
    enrichGenreNames(items, await genreNames("movie", lang), data.results)
    await enrichCertifications(items, "movie")
    return paginate(items, data.page, data.total_pages, data.total_results)
  },
}
