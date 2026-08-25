import { tmdb } from "./tmdb"
import { DEFAULT_LANGUAGE, type Language } from "../lib/language"
import * as images from "../lib/images"
import {
  mapMovie, mapTV, mapEpisode, paginate,
} from "../lib/mappers"
import type {
  TMDBMultiResult, TMDBDiscoverParams, TMDBMovie, TMDBTVShow,
} from "../types/tmdb"
import {
  resolveExternalIds, extractTrailers, formatCredits,
  genreNames, enrichGenreNames, enrichCertifications,
  movieDetailFromTMDB, tvDetailFromTMDB,
  type TmdbCreditsResponse,
} from "./media/utils"
import { validMovieCredit, validTVCredit } from "./tmdb/filters"

async function enrichedPage(
  type: "movie" | "tv",
  data: { results: any[]; page: number; total_pages: number; total_results: number },
  lang: Language,
) {
  const mapper = type === "movie" ? mapMovie : mapTV
  const items = data.results.map(mapper)
  const [names] = await Promise.all([
    genreNames(type, lang),
  ])
  enrichGenreNames(items, names, data.results)
  await enrichCertifications(items, type)
  return paginate(items, data.page, data.total_pages, data.total_results)
}

export const media = {
  async person(id: number, lang = DEFAULT_LANGUAGE) {
    const p = await tmdb.person(id, lang)
    return {
      tmdbId: p.id,
      name: p.name,
      profile: tmdb.imageUrl(p.profile_path, "w342"),
      profiles: tmdb.imageSizes(p.profile_path, images.PROFILE_SIZES),
      department: p.known_for_department,
    }
  },

  async personCredits(id: number, pageNum = 1, lang = DEFAULT_LANGUAGE) {
    const [movieCredits, tvCredits] = await Promise.all([
      tmdb.personMovieCredits(id, lang),
      tmdb.personTvCredits(id, lang),
    ])

    interface CreditBase {
      id: number
      overview: string
      poster_path: string | null
      vote_average: number
      vote_count: number
      popularity: number
      character?: string
      job?: string
    }

    const toMovie = (m: CreditBase & { title: string; original_title: string; release_date: string }) => ({
      tmdbId: m.id,
      title: m.title,
      originalTitle: m.original_title,
      overview: m.overview ?? "",
      poster: tmdb.imageUrl(m.poster_path, "w500"),
      releaseDate: m.release_date || null,
      voteAverage: m.vote_average ?? 0,
      voteCount: m.vote_count ?? 0,
      popularity: m.popularity ?? 0,
      mediaType: "movie" as const,
      role: m.character ?? m.job ?? null,
      creditType: (m.character ? "cast" : "crew") as "cast" | "crew",
    })

    const toTV = (s: CreditBase & { name: string; original_name: string; first_air_date: string }) => ({
      tmdbId: s.id,
      title: s.name,
      originalTitle: s.original_name,
      overview: s.overview ?? "",
      poster: tmdb.imageUrl(s.poster_path, "w500"),
      releaseDate: s.first_air_date || null,
      voteAverage: s.vote_average ?? 0,
      voteCount: s.vote_count ?? 0,
      popularity: s.popularity ?? 0,
      mediaType: "tv" as const,
      role: s.character ?? s.job ?? null,
      creditType: (s.character ? "cast" : "crew") as "cast" | "crew",
    })

    type CreditItem = ReturnType<typeof toMovie> | ReturnType<typeof toTV>

    const dedupe = (items: CreditItem[]) => {
      const seen = new Map<number, CreditItem>()
      for (const item of items) {
        const existing = seen.get(item.tmdbId)
        if (!existing || (existing.creditType === "crew" && item.creditType === "cast")) {
          seen.set(item.tmdbId, item)
        }
      }
      return [...seen.values()]
    }

    // TMDB credits include every credited role (minor/uncredited/obscure titles).
    // Apply the credit validators (poster, released, overview, genres, valid
    // title, soft engagement floor) to drop shorts, non-localized and junk
    // entries while keeping fresh and little-known titles.
    const all = dedupe([
      ...(movieCredits.cast || []).filter(validMovieCredit).map(toMovie),
      ...(movieCredits.crew || []).filter(validMovieCredit).map(toMovie),
      ...(tvCredits.cast || []).filter(validTVCredit).map(toTV),
      ...(tvCredits.crew || []).filter(validTVCredit).map(toTV),
    ]).sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))

    const pageSize = 30
    const totalResults = all.length
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
    const start = (pageNum - 1) * pageSize
    const slice = all.slice(start, start + pageSize)

    return paginate(slice, pageNum, totalPages, totalResults)
  },

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
      ...movieDetailFromTMDB(movie),
      imdbId: resolved.imdbId,
      kpId: resolved.kpId,
      imdbRating: resolved.imdbRating,
      imdbVotes: resolved.imdbVotes,
      certification,
      trailers: extractTrailers(videos),
      credits: formatCredits(c as unknown as TmdbCreditsResponse),
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
    const tmdbImdbId = externalIds?.imdb_id ?? null
    const resolved = await resolveExternalIds(id, "tv", tmdbImdbId)
    return {
      ...mapTV(show),
      ...tvDetailFromTMDB(show),
      imdbId: resolved.imdbId,
      kpId: resolved.kpId,
      imdbRating: resolved.imdbRating,
      imdbVotes: resolved.imdbVotes,
      certification,
      trailers: extractTrailers(videos),
      credits: formatCredits(c as unknown as TmdbCreditsResponse),
    }
  },

  async movieCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return formatCredits(await tmdb.movieCredits(id, lang) as unknown as TmdbCreditsResponse)
  },

  async tvCredits(id: number, lang = DEFAULT_LANGUAGE) {
    return formatCredits(await tmdb.tvCredits(id, lang) as unknown as TmdbCreditsResponse)
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
      posters: tmdb.imageSizes(data.poster_path, images.POSTER_SIZES),
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
    const fetcher = fetchers[`${type}:${method}`]
    if (!fetcher) throw new Error(`Unknown list: ${type}/${method}`)

    const data = await fetcher(pageNum, lang)
    return enrichedPage(type, data, lang)
  },

  async trending(method: string, pageNum: number, lang = DEFAULT_LANGUAGE, typeFilter?: "movie" | "tv") {
    const [movieData, tvData] = await Promise.all([
      typeFilter !== "tv" ? this.list("movie", method, pageNum, lang) : null,
      typeFilter !== "movie" ? this.list("tv", method, pageNum, lang) : null,
    ])

    if (typeFilter === "movie" || typeFilter === "tv") {
      return typeFilter === "movie" ? movieData! : tvData!
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
    // TMDB `/similar` is often weakly related. `/recommendations` matches
    const recommended = await tmdb.recommendations(type, id, pageNum, lang)
    if (recommended.results?.length) {
      return enrichedPage(type, recommended, lang)
    }
    const data = await tmdb.similar(type, id, pageNum, lang)
    return enrichedPage(type, data, lang)
  },

  async recommendations(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    const data = await tmdb.recommendations(type, id, pageNum, lang)
    return enrichedPage(type, data, lang)
  },

  async relatedByCast(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    // TMDB discover `with_people` is unreliable for TV (often ignored).
    // Aggregate real person credits instead, then score by shared cast/crew + genres.
    const [details, credits] = await Promise.all([
      type === "movie" ? tmdb.movie(id, lang) : tmdb.tvShow(id, lang),
      type === "movie" ? tmdb.movieCredits(id, lang) : tmdb.tvCredits(id, lang),
    ])

    const sourceGenres = new Set((details.genres || []).map((g) => g.id))
    const isAnimation = sourceGenres.has(16)

    const cast = ((credits.cast || []) as Array<{ id: number }>).slice(0, 5)
    const CREATOR_JOBS = new Set([
      "Creator",
      "Executive Producer",
      "Writer",
      "Director",
      "Characters",
      "Original Series Creator",
      "Supervising Producer",
      "Developer",
      "Novel",
      "Screenplay",
      "Story",
    ])
    const crew = ((credits.crew || []) as Array<{ id: number; job: string }>)
      .filter((c) => (c.job || "").split(",").some((j) => CREATOR_JOBS.has(j.trim())))
      .slice(0, 8)

    const peopleIds = [...new Set([...cast, ...crew].map((p) => p.id).filter(Boolean))]
    if (!peopleIds.length) {
      return paginate([], pageNum, 0, 0)
    }

    const creditPages = await Promise.all(
      peopleIds.map((pid) =>
        type === "movie"
          ? tmdb.personMovieCredits(pid, lang)
          : tmdb.personTvCredits(pid, lang),
      ),
    )

    type CreditItem = (TMDBMovie | TMDBTVShow) & { genre_ids?: number[] }
    const scores = new Map<number, {
      item: CreditItem
      hits: number
      popularity: number
      genres: Set<number>
    }>()

    for (const page of creditPages) {
      const entries = [...(page.cast || []), ...(page.crew || [])] as CreditItem[]
      for (const item of entries) {
        if (!item?.id || item.id === id) continue
        // Drop unreleased, undated, non-localized and junk titles
        if ("release_date" in item ? !validMovieCredit(item) : !validTVCredit(item)) continue
        const existing = scores.get(item.id)
        const genres = new Set(item.genre_ids || [])
        if (existing) {
          existing.hits += 1
          existing.popularity = Math.max(existing.popularity, item.popularity || 0)
          for (const g of genres) existing.genres.add(g)
          if ((item.vote_count || 0) > (existing.item.vote_count || 0)) {
            existing.item = item
          }
        } else {
          scores.set(item.id, {
            item,
            hits: 1,
            popularity: item.popularity || 0,
            genres,
          })
        }
      }
    }

    const ranked = [...scores.values()]
      .map((entry) => {
        const overlap = [...entry.genres].filter((g) => sourceGenres.has(g)).length
        const hasAnimation = entry.genres.has(16)
        // Drop titles with no genre overlap unless source isn't tagged yet
        if (sourceGenres.size > 0 && overlap === 0) return null
        // For animated sources, keep the row on-brand
        if (isAnimation && !hasAnimation) return null

        const score =
          overlap * 12 +
          entry.hits * 10 +
          Math.log1p(entry.popularity) +
          (hasAnimation && isAnimation ? 18 : 0) +
          Math.log1p(entry.item.vote_count || 0) * 0.5

        return { score, item: entry.item }
      })
      .filter((x): x is { score: number; item: CreditItem } => Boolean(x))
      .sort((a, b) => b.score - a.score)

    const pageSize = 20
    const totalResults = ranked.length
    const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))
    const start = (pageNum - 1) * pageSize
    const slice = ranked.slice(start, start + pageSize).map((r) => r.item)

    return enrichedPage(
      type,
      {
        results: slice as any[],
        page: pageNum,
        total_pages: totalPages,
        total_results: totalResults,
      },
      lang,
    )
  },

  async relatedByStudio(type: "movie" | "tv", id: number, pageNum: number, lang = DEFAULT_LANGUAGE) {
    // Prefer production companies ("studio") over broadcast networks — matches Plex better.
    if (type === "movie") {
      const movie = await tmdb.movie(id, lang)
      const companies = (movie.production_companies || []).filter((c) => c.id)
      if (!companies.length) {
        return { ...paginate([], pageNum, 0, 0), label: null as string | null }
      }

      const companyIds = companies.slice(0, 2).map((c) => c.id).join("|")
      const label = companies[0].name
      const data = await tmdb.discoverMovie(
        { page: pageNum, sort_by: "popularity.desc", with_companies: companyIds },
        lang,
      )
      data.results = data.results.filter((item) => item.id !== id)
      const page = await enrichedPage(type, data, lang)
      return { ...page, label }
    }

    const show = await tmdb.tvShow(id, lang)
    const companies = (show.production_companies || []).filter((c) => c.id)
    const genres = (show.genres || []).map((g) => g.id)
    const networkId = show.networks?.[0]?.id
    const networkName = show.networks?.[0]?.name ?? null

    if (companies.length) {
      const companyIds = companies.slice(0, 2).map((c) => c.id).join("|")
      const label = companies[0].name
      const data = await tmdb.discoverTV(
        {
          page: pageNum,
          sort_by: "popularity.desc",
          with_companies: companyIds,
          ...(genres.length ? { with_genres: genres.slice(0, 2).join(",") } : {}),
        },
        lang,
      )
      data.results = data.results.filter((item) => item.id !== id)

      // If company+genre is too strict, retry companies only
      if (!data.results.length) {
        const fallback = await tmdb.discoverTV(
          { page: pageNum, sort_by: "popularity.desc", with_companies: companyIds },
          lang,
        )
        fallback.results = fallback.results.filter((item) => item.id !== id)
        const page = await enrichedPage(type, fallback, lang)
        return { ...page, label }
      }

      const page = await enrichedPage(type, data, lang)
      return { ...page, label }
    }

    if (networkId) {
      const data = await tmdb.discoverTV(
        {
          page: pageNum,
          sort_by: "popularity.desc",
          with_networks: networkId,
          ...(genres.length ? { with_genres: genres.slice(0, 2).join(",") } : {}),
        },
        lang,
      )
      data.results = data.results.filter((item) => item.id !== id)
      const page = await enrichedPage(type, data, lang)
      return { ...page, label: networkName }
    }

    return { ...paginate([], pageNum, 0, 0), label: null as string | null }
  },

  async search(p: Record<string, string | undefined>, lang = DEFAULT_LANGUAGE) {
    const { q, type, genre, year, yearFrom, yearTo, rating, ratingFrom, ratingTo, keyword, country, sort_by, page: pageStr } = p
    const pageNum = parseInt(pageStr || "1")

    if (q) {
      const mediaType = type || "multi"
      if (mediaType === "movie") {
        const [data, localised] = await Promise.all([
          tmdb.searchMovie(q, pageNum, lang),
          tmdb.searchMovieLocalised(q, pageNum, lang),
        ])
        const locMap = new Map(localised.results.map(r => [r.id, r]))
        const merged = { ...data, results: data.results.map(r => ({ ...r, ...locMap.get(r.id) })) }
        return enrichedPage("movie", merged, lang)
      }
      if (mediaType === "tv") {
        const [data, localised] = await Promise.all([
          tmdb.searchTV(q, pageNum, lang),
          tmdb.searchTVLocalised(q, pageNum, lang),
        ])
        const locMap = new Map(localised.results.map(r => [r.id, r]))
        const merged = { ...data, results: data.results.map(r => ({ ...r, ...locMap.get(r.id) })) }
        return enrichedPage("tv", merged, lang)
      }
      // multi: search without language for matching, enrich with localised data
      const [data, locMovies, locTV] = await Promise.all([
        tmdb.searchMulti(q, pageNum, lang),
        tmdb.searchMovieLocalised(q, pageNum, lang).then(r => new Map(r.results.map(m => [m.id, m]))),
        tmdb.searchTVLocalised(q, pageNum, lang).then(r => new Map(r.results.map(m => [m.id, m]))),
      ])
      const multiResult = data.results.map((item: TMDBMultiResult) => {
        if (item.media_type === "movie") {
          const loc = locMovies.get(item.id)
          return { ...mapMovie(loc ? { ...item, ...loc } : item), mediaType: "movie" }
        }
        if (item.media_type === "tv") {
          const loc = locTV.get(item.id)
          return { ...mapTV(loc ? { ...item, ...loc } : item), mediaType: "tv" }
        }
        return {
          mediaType: "person", tmdbId: item.id, name: item.name,
          profile: tmdb.imageUrl(item.profile_path, "w185"),
          department: item.known_for_department,
        }
      })
      const movieItems = multiResult.filter(r => r.mediaType === "movie") as any[]
      const tvItems = multiResult.filter(r => r.mediaType === "tv") as any[]
      const movieRaw = data.results.filter((r: TMDBMultiResult) => r.media_type === "movie") as any[]
      const tvRaw = data.results.filter((r: TMDBMultiResult) => r.media_type === "tv") as any[]
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
      return enrichedPage("tv", data, lang)
    }
    const data = await tmdb.discoverMovie(discover as TMDBDiscoverParams, lang)
    return enrichedPage("movie", data, lang)
  },
}
