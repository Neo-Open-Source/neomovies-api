import { tmdb } from "./tmdb"
import { db } from "../db"
import { DEFAULT_LANGUAGE, type Language } from "../lib/language"
import { mapMovie, mapTV, mapCastMember, mapCrewMember, mapCompany, mapSeason, mapNetwork, mapEpisode, paginate } from "../lib/mappers"

async function imdbRating(imdbId: string | null) {
  if (!imdbId) return { imdbRating: null, imdbVotes: null }
  const rating = await db.mediaRating.findUnique({ where: { imdbId } })
  return {
    imdbRating: rating ? Number(rating.imdbRating) : null,
    imdbVotes: rating?.imdbVotes ?? null,
  }
}

function credits(c: { cast: any[]; crew: any[] }) {
  return {
    cast: (c.cast || []).slice(0, 20).map(mapCastMember),
    crew: (c.crew || []).slice(0, 20).map(mapCrewMember),
  }
}

export const media = {
  async movieDetail(id: number, lang = DEFAULT_LANGUAGE) {
    const [movie, c] = await Promise.all([
      tmdb.movie(id, lang),
      tmdb.movieCredits(id, lang),
    ])
    const rating = await imdbRating(movie.imdb_id)
    return {
      ...mapMovie(movie),
      ...rating,
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
      credits: credits(c),
    }
  },

  async tvDetail(id: number, lang = DEFAULT_LANGUAGE) {
    const [show, c] = await Promise.all([
      tmdb.tvShow(id, lang),
      tmdb.tvCredits(id, lang),
    ])
    const externalIds = await tmdb.tvExternalIds(id).catch(() => null)
    const imdbId = externalIds?.imdb_id ?? null
    const rating = await imdbRating(imdbId)
    return {
      ...mapTV(show),
      imdbId,
      ...rating,
      seasons: (show.seasons || []).map(mapSeason),
      numberOfSeasons: show.number_of_seasons,
      numberOfEpisodes: show.number_of_episodes,
      status: show.status,
      tagline: show.tagline,
      networks: (show.networks || []).map(mapNetwork),
      productionCompanies: (show.production_companies || []).map(mapCompany),
      credits: credits(c),
    }
  },

  async movieCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return credits(await tmdb.movieCredits(id, lang))
  },

  async tvCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return credits(await tmdb.tvCredits(id, lang))
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

    const coll = await tmdb.collection(movie.belongs_to_collection.id, lang)
    const parts = (coll.parts || [])
      .filter((p: any) => p.id !== id)
      .sort((a: any, b: any) => (a.release_date || "").localeCompare(b.release_date || ""))
      .map(mapMovie)

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
    const fetchers: Record<string, (page: number, lang: Language) => any> = {
      "movie:popular": tmdb.popularMovies.bind(tmdb),
      "movie:top-rated": tmdb.topRatedMovies.bind(tmdb),
      "movie:upcoming": tmdb.upcomingMovies.bind(tmdb),
      "tv:popular": tmdb.popularTV.bind(tmdb),
      "tv:top-rated": tmdb.topRatedTV.bind(tmdb),
    }
    const mapper = type === "movie" ? mapMovie : mapTV
    const fetcher = fetchers[`${type}:${method}`]
    if (!fetcher) throw new Error(`Unknown list: ${type}/${method}`)

    const data = await fetcher(pageNum, lang)
    return paginate(data.results.map(mapper), data.page, data.total_pages, data.total_results)
  },

  async similar(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.similar(type, id, pageNum, lang)
    const mapper = type === "movie" ? mapMovie : mapTV
    return paginate(data.results.map(mapper as any), data.page, data.total_pages, data.total_results)
  },

  async recommendations(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.recommendations(type, id, pageNum, lang)
    const mapper = type === "movie" ? mapMovie : mapTV
    return paginate(data.results.map(mapper as any), data.page, data.total_pages, data.total_results)
  },

  async search(p: Record<string, string | undefined>, lang = DEFAULT_LANGUAGE) {
    const { q, type, genre, year, rating, keyword, country, sort_by, page: pageStr } = p
    const pageNum = parseInt(pageStr || "1")

    if (q) {
      const mediaType = type || "multi"
      if (mediaType === "movie") {
        const data = await tmdb.searchMovie(q, pageNum, lang)
        return paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results)
      }
      if (mediaType === "tv") {
        const data = await tmdb.searchTV(q, pageNum, lang)
        return paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results)
      }
      const data = await tmdb.searchMulti(q, pageNum, lang)
      return paginate(
        data.results.map((item: any) => {
          if (item.media_type === "movie") return { ...mapMovie(item), mediaType: "movie" }
          if (item.media_type === "tv") return { ...mapTV(item), mediaType: "tv" }
          return {
            mediaType: "person", tmdbId: item.id, name: item.name,
            profile: tmdb.imageUrl(item.profile_path, "w185"),
            department: item.known_for_department,
          }
        }),
        data.page, data.total_pages, data.total_results,
      )
    }

    const discover: Record<string, string> = {}
    if (genre) discover.with_genres = genre
    if (year) { discover["primary_release_date.gte"] = `${year}-01-01`; discover["primary_release_date.lte"] = `${year}-12-31` }
    if (rating) discover["vote_average.gte"] = rating
    if (keyword) discover.with_keywords = keyword
    if (country) discover.with_original_language = country
    if (pageStr) discover.page = pageStr
    discover.sort_by = sort_by || "popularity.desc"

    const mediaType = type || "movie"
    if (mediaType === "tv") {
      const data = await tmdb.discoverTV(discover as any, lang)
      return paginate(data.results.map(mapTV), data.page, data.total_pages, data.total_results)
    }
    const data = await tmdb.discoverMovie(discover as any, lang)
    return paginate(data.results.map(mapMovie), data.page, data.total_pages, data.total_results)
  },
}
