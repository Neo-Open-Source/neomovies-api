import { media } from "../../services/media"
import { tmdb } from "../../services/tmdb"
import { userData } from "../../services/user-data"
import { config } from "../../config"
import { neoid } from "../../services/neoid"
import { getAllohaPlayerUrl, getCollapsPlayerUrl } from "../../services/players"
import { getPlayerData, resolveCdnId } from "../../services/cdn"
import { badRequest, requireAuth, type GraphQLContext } from "../context"
import { language as langHelper, type Language } from "../../lib/language"
import { mapMovie, mapTV } from "../../lib/mappers"
import {
  listCategories, studioCategories, networkCategories, allStaticCategories,
  type CategoryDef,
} from "../../data/categories"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lang(args: Record<string, any>): Language {
  return langHelper({ language: args.language })
}

// ---------------------------------------------------------------------------
// Genre backdrop cache
// ---------------------------------------------------------------------------

const genreBackdropCache = new Map<string, { backdrop: string | null; at: number }>()
const GENRE_CACHE_TTL_MS = 5 * 60 * 1000

async function getGenreBackdrop(genreId: number, l: Language): Promise<string | null> {
  const key = `${genreId}:${l}`
  const cached = genreBackdropCache.get(key)
  if (cached && Date.now() - cached.at < GENRE_CACHE_TTL_MS) return cached.backdrop

  let tmdbId: number | null = null
  let mediaType: "movie" | "tv" = "movie"

  const tryDiscover = async (
    fetcher: () => Promise<{ results: Array<{ id: number; backdrop_path?: string | null }> }>,
    type: "movie" | "tv",
  ) => {
    const result = await fetcher()
    const items = result.results.filter(r => r.backdrop_path)
    if (items.length > 0) {
      tmdbId = items[Math.floor(Math.random() * items.length)].id
      mediaType = type
    }
  }

  try {
    await tryDiscover(
      () => tmdb.discoverMovie({ with_genres: String(genreId), page: 1, sort_by: "popularity.desc" }, l),
      "movie",
    )
  } catch {}

  if (!tmdbId) {
    try {
      await tryDiscover(
        () => tmdb.discoverTV({ with_genres: String(genreId), page: 1, sort_by: "popularity.desc" }, l),
        "tv",
      )
    } catch {}
  }

  const backdrop = tmdbId
    ? `${config.publicUrl}/api/v1/images/backdrop/${tmdbId}?type=${mediaType}`
    : null

  genreBackdropCache.set(key, { backdrop, at: Date.now() })
  return backdrop
}

// ---------------------------------------------------------------------------
// Category slug resolver
// ---------------------------------------------------------------------------

async function resolveCategorySlug(
  slug: string,
  l: Language,
  pageNum: number,
): Promise<{ data: any; cat: CategoryDef } | null> {
  // Clients may pass either the category id or its slug (REST used id).
  const cat =
    allStaticCategories.find(c => c.slug === slug) ??
    allStaticCategories.find(c => c.id === slug)

  if (cat) {
    if (cat.kind === "list") {
      const data = await media.list(cat.mediaType, cat.value, pageNum, l)
      return { data, cat }
    }

    if (cat.kind === "company") {
      const [movieDisc, tvDisc] = await Promise.all([
        tmdb.discoverMovie({ with_companies: cat.value, page: pageNum }, l).catch(() => null),
        tmdb.discoverTV({ with_companies: cat.value, page: pageNum }, l).catch(() => null),
      ])
      const movieItems = movieDisc?.results.map(mapMovie) ?? []
      const tvItems    = tvDisc?.results.map(mapTV) ?? []
      const allItems   = [...movieItems, ...tvItems].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      return {
        data: {
          items: allItems,
          page: pageNum,
          totalPages: Math.max(movieDisc?.total_pages ?? 0, tvDisc?.total_pages ?? 0),
          totalResults: (movieDisc?.total_results ?? 0) + (tvDisc?.total_results ?? 0),
        },
        cat,
      }
    }

    if (cat.kind === "network") {
      const disc = await tmdb.discoverTV({ with_networks: cat.value, page: pageNum }, l)
      return {
        data: {
          items: disc.results.map(mapTV),
          page: disc.page,
          totalPages: disc.total_pages,
          totalResults: disc.total_results,
        },
        cat,
      }
    }
  }

  if (slug.startsWith("genre-")) {
    const genreId = slug.replace("genre-", "")
    const [movieDisc, tvDisc] = await Promise.all([
      tmdb.discoverMovie({ with_genres: genreId, page: pageNum }, l).catch(() => null),
      tmdb.discoverTV({ with_genres: genreId, page: pageNum }, l).catch(() => null),
    ])

    const fallbackCat: CategoryDef = {
      id: slug, name: genreId, slug,
      kind: "genre", mediaType: "movie", value: genreId,
    }

    if (movieDisc?.results.length) {
      return { data: { items: movieDisc.results.map(mapMovie), page: movieDisc.page, totalPages: movieDisc.total_pages, totalResults: movieDisc.total_results }, cat: fallbackCat }
    }
    if (tvDisc?.results.length) {
      return { data: { items: tvDisc.results.map(mapTV), page: tvDisc.page, totalPages: tvDisc.total_pages, totalResults: tvDisc.total_results }, cat: { ...fallbackCat, mediaType: "tv" } }
    }
    return { data: { items: [], page: pageNum, totalPages: 1, totalResults: 0 }, cat: fallbackCat }
  }

  return null
}

// ---------------------------------------------------------------------------
// Categories section builder
// ---------------------------------------------------------------------------

async function buildCategorySections(l: Language) {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdb.movieGenres(l).catch(() => ({ genres: [] as { id: number; name: string }[] })),
    tmdb.tvGenres(l).catch(() => ({ genres: [] as { id: number; name: string }[] })),
  ])

  // Merge genres from both lists, movie genres take priority for name
  const genreMap = new Map<number, string>()
  for (const g of movieGenres.genres) genreMap.set(g.id, g.name)
  for (const g of tvGenres.genres) if (!genreMap.has(g.id)) genreMap.set(g.id, g.name)

  const genreItems = await Promise.all(
    Array.from(genreMap, ([id, name]) => ({ id, name })).map(async (g) => {
      const backdrop = await getGenreBackdrop(g.id, l)
      return {
        id: `genre-${g.id}`,
        name: g.name.charAt(0).toUpperCase() + g.name.slice(1),
        slug: `genre-${g.name.toLowerCase().replace(/\s+/g, "-")}`,
        type: undefined as any,
        backdrop,
      }
    }),
  )

  const toSectionItem = (cat: CategoryDef) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    type: cat.mediaType,
    backdrop: null,
  })

  return [
    { section: "Browse",  items: listCategories.map(toSectionItem) },
    { section: "Genres",  items: genreItems },
    { section: "Studios", items: [...studioCategories, ...networkCategories].map(toSectionItem) },
  ]
}

// ---------------------------------------------------------------------------
// Player resolver helper
// ---------------------------------------------------------------------------

async function resolvePlayer(args: Record<string, any>) {
  const { provider, kpId, tmdbId, imdbId, season, episode } = args

  if (provider === "alloha") {
    return getAllohaPlayerUrl(kpId ?? undefined, tmdbId ?? undefined, imdbId ?? undefined, season ?? undefined, episode ?? undefined)
  }

  if (provider === "collaps") {
    return getCollapsPlayerUrl(kpId ?? undefined, imdbId ?? undefined, season ?? undefined, episode ?? undefined)
  }

  if (provider === "cdn") {
    let cdnId: number | undefined = args.cdnId ?? undefined
    if (imdbId) cdnId = await resolveCdnId(imdbId, "imdb")
    else if (kpId) cdnId = await resolveCdnId(String(kpId), "kp")
    if (!cdnId) throw new Error("Missing cdnId, kpId, or imdbId")
    const data = await getPlayerData(cdnId, season ?? undefined, episode ?? undefined)
    return { provider: "CDN", ...data, type: "hls" }
  }

  throw new Error("Unknown provider")
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export const queryResolvers = {
  Query: {
    health: () => ({
      status: "ok",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
    }),

    media: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      if (args.type === "movie") {
        return { ...await media.movieDetail(args.id, l), __typename: "MovieDetail" }
      }
      return { ...await media.tvDetail(args.id, l), __typename: "TVDetail" }
    },

    mediaCredits: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      return args.type === "movie"
        ? media.movieCredits(args.id, l)
        : media.tvCredits(args.id, l)
    },

    recommendations: async (_: any, args: Record<string, any>) =>
      media.recommendations(args.type, args.id, args.page ?? 1, lang(args)),

    similar: async (_: any, args: Record<string, any>) =>
      media.similar(args.type, args.id, args.page ?? 1, lang(args)),

    relatedByCast: async (_: any, args: Record<string, any>) =>
      media.relatedByCast(args.type, args.id, args.page ?? 1, lang(args)),

    relatedByStudio: async (_: any, args: Record<string, any>) =>
      media.relatedByStudio(args.type, args.id, args.page ?? 1, lang(args)),

    mediaCollection: async (_: any, args: Record<string, any>) =>
      media.collection(args.id, lang(args)),

    season: async (_: any, args: Record<string, any>) =>
      media.season(args.tvId, args.season, lang(args)),

    episode: async (_: any, args: Record<string, any>) =>
      media.episode(args.tvId, args.season, args.episode, lang(args)),

    movieList: async (_: any, args: Record<string, any>) =>
      media.list("movie", args.list === "top_rated" ? "top-rated" : args.list, args.page ?? 1, lang(args)),

    tvList: async (_: any, args: Record<string, any>) =>
      media.list("tv", args.list === "top_rated" ? "top-rated" : args.list, args.page ?? 1, lang(args)),

    trending: async (_: any, args: Record<string, any>) => {
      const typeFilter = args.type === "movie" || args.type === "tv" ? args.type : undefined
      const result = await media.trending("popular", args.page ?? 1, lang(args), typeFilter)
      // Deduplicate in case the same item appears in both movie & tv results
      const seen = new Set<string>()
      result.items = result.items.filter((item: any) => {
        const key = `${item.mediaType ?? "unknown"}:${item.tmdbId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return result
    },

    search: async (_: any, args: Record<string, any>) => {
      const query: Record<string, string | undefined> = {}
      for (const [k, v] of Object.entries(args)) {
        if (v !== undefined && v !== null) query[k] = String(v)
      }
      return media.search(query, lang(args))
    },

    genres: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      const [movie, tv] = await Promise.all([
        tmdb.movieGenres(l).catch(() => ({ genres: [] })),
        tmdb.tvGenres(l).catch(() => ({ genres: [] })),
      ])
      return { movie: movie.genres, tv: tv.genres }
    },

    person: async (_: any, args: Record<string, any>) =>
      media.person(args.id, lang(args)),

    personCredits: async (_: any, args: Record<string, any>) =>
      media.personCredits(args.id, args.page ?? 1, lang(args)),

    categories: async (_: any, args: Record<string, any>) =>
      buildCategorySections(lang(args)),

    categoryCollection: async (_: any, args: Record<string, any>) => {
      const result = await resolveCategorySlug(args.slug, lang(args), args.page ?? 1)
      if (!result) throw badRequest("Category not found")
      return { ...result.data, category: { id: result.cat.id, name: result.cat.name, slug: result.cat.slug } }
    },

    player: async (_: any, args: Record<string, any>) =>
      resolvePlayer(args),

    cdnPlayer: async (_: any, args: Record<string, any>) => {
      let cdnId: number | undefined = args.cdnId ?? undefined
      if (args.imdbId) cdnId = await resolveCdnId(args.imdbId, "imdb")
      else if (args.kpId) cdnId = await resolveCdnId(String(args.kpId), "kp")
      if (!cdnId) throw new Error("Missing cdnId, kpId, or imdbId")
      const data = await getPlayerData(cdnId, args.season ?? undefined, args.episode ?? undefined)
      return { provider: "CDN", ...data, type: "hls" }
    },

    favorites: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.listFavorites(userId, args.page ?? 1, lang(args))
    },

    me: async (_: any, __: unknown, ctx: GraphQLContext) => {
      requireAuth(ctx)
      if (ctx.authorization) {
        try {
          const user = await neoid.getUser(ctx.authorization.slice(7))
          return {
            id: user.id,
            email: user.email,
            displayName: user.displayName ?? null,
            avatar: user.avatar ?? null,
            role: user.role,
          }
        } catch {}
      }
      return {
        id: ctx.userId,
        email: ctx.userEmail,
        displayName: null,
        avatar: null,
        role: ctx.userRole,
      }
    },

    watchLater: async (_: any, __: any, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.listWatchLater(userId)
    },

    syncProgress: async (_: any, __: any, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      const items = await userData.getSyncProgress(userId)

      if (!items.length) return []

      // Batch-fetch all unique IDs in parallel — no N+1
      const movieIds = [...new Set(items.filter((i: any) => i.mediaType !== "tv").map((i: any) => i.mediaId as number))]
      const tvIds    = [...new Set(items.filter((i: any) => i.mediaType === "tv").map((i: any) => i.mediaId as number))]

      const [movieMap, tvMap] = await Promise.all([
        Promise.all(movieIds.map(id => tmdb.movie(id).then(m => [id, m] as const).catch(() => [id, null] as const)))
          .then(entries => new Map(entries)),
        Promise.all(tvIds.map(id => tmdb.tvShow(id).then(s => [id, s] as const).catch(() => [id, null] as const)))
          .then(entries => new Map(entries)),
      ])

      // Batch-fetch unique (tvId, season) pairs
      const seasonKeys = [...new Set(
        items
          .filter((i: any) => i.mediaType === "tv" && i.season != null && i.episode != null)
          .map((i: any) => `${i.mediaId}:${i.season}`),
      )]
      const seasonMap = new Map<string, any>()
      await Promise.all(
        seasonKeys.map(async (key) => {
          const [tvIdStr, seasonStr] = key.split(":")
          try {
            const data = await tmdb.tvSeason(Number(tvIdStr), Number(seasonStr))
            seasonMap.set(key, data)
          } catch {}
        }),
      )

      return items.map((item: any) => {
        try {
          if (item.mediaType === "tv") {
            const tv = tvMap.get(item.mediaId)
            if (!tv) return { ...item, title: null, poster: null, backdrop: null, episodeName: null, episodeStill: null }

            let episodeName: string | null = null
            let episodeStill: string | null = null
            if (item.season != null && item.episode != null) {
              const seasonData = seasonMap.get(`${item.mediaId}:${item.season}`)
              const ep = seasonData?.episodes?.find((e: any) => e.episode_number === item.episode)
              if (ep) {
                episodeName = ep.name ?? null
                episodeStill = tmdb.imageUrl(ep.still_path, "w300")
              }
            }
            return {
              ...item,
              title: tv.name ?? null,
              poster: tmdb.imageUrl(tv.poster_path, "w300"),
              backdrop: tmdb.imageUrl(tv.backdrop_path, "w300"),
              episodeName,
              episodeStill,
            }
          }

          const movie = movieMap.get(item.mediaId)
          if (!movie) return { ...item, title: null, poster: null, backdrop: null, episodeName: null, episodeStill: null }
          return {
            ...item,
            title: movie.title ?? null,
            poster: tmdb.imageUrl(movie.poster_path, "w300"),
            backdrop: tmdb.imageUrl(movie.backdrop_path, "w300"),
            episodeName: null,
            episodeStill: null,
          }
        } catch {
          return { ...item, title: null, poster: null, backdrop: null, episodeName: null, episodeStill: null }
        }
      })
    },

    loginUrl: (_: any, args: Record<string, any>) => {
      const extra: Record<string, string> = {}
      if (args.codeChallenge) extra.code_challenge = args.codeChallenge
      if (args.codeChallengeMethod) extra.code_challenge_method = args.codeChallengeMethod
      if (args.state) extra.state = args.state
      return neoid.getAuthorizeUrl(args.redirectUri ?? undefined, extra)
    },

    torrentSearch: async (_: any, args: Record<string, any>) => {
      const { q, imdbId } = args
      if (!q && !imdbId) throw badRequest("Missing search query (q or imdbId)")

      const params = new URLSearchParams()
      if (q) params.set("query", q)
      if (imdbId) params.set("imdb_id", imdbId)

      const res = await fetch(
        `${config.redapi.baseUrl}/torrents/search?${params.toString()}`,
        { headers: { "Content-Type": "application/json" } },
      )
      if (!res.ok) throw new Error("Torrent search failed")

      const data = await res.json() as { results: any[] }
      return data.results.map(t => ({
        title:    t.title,
        seeders:  t.seeders,
        leechers: t.leechers,
        size:     t.size,
        magnet:   t.magnet,
        quality:  t.quality,
        type:     t.type,
      }))
    },

    supporters: () => [
      { id: 1, name: "Sophron Ragozin", type: ["service"], description: "Покупка и продления основного домена neowatch.ru",       contributions: ["Домен neowatch.ru"],       year: 2025, isActive: false },
      { id: 2, name: "Chernuha",        type: ["code"],    description: "Помощь с iOS версией",                                  contributions: ["iOS разработка"],          year: 2025, isActive: true  },
      { id: 3, name: "Iwnuply",         type: ["code"],    description: "Создание докер контейнера для API и Frontend",          contributions: ["Docker"],                  year: 2025, isActive: false },
    ],
  },
}
