import { media } from "../../services/media"
import { tmdb } from "../../services/tmdb"
import { userData } from "../../services/user-data"
import { config } from "../../config"
import { neoid } from "../../services/neoid"
import { getAllohaPlayerUrl } from "../../services/players"
import { getCollapsPlayerUrl } from "../../services/players"
import { getPlayerData, resolveCdnId } from "../../services/cdn"
import { requireAuth, type GraphQLContext } from "../context"
import { language as langHelper } from "../../lib/language"
import { mapMovie, mapTV } from "../../lib/mappers"

function lang(args: Record<string, any>): string {
  return langHelper({ language: args.language }) as string
}

interface CategoryDef {
  id: string
  name: string
  slug: string
  kind: "list" | "genre" | "company" | "network"
  mediaType: "movie" | "tv"
  value: string
}

const listCategories: CategoryDef[] = [
  { id: "popular-movies", name: "Popular Movies", slug: "popular-movies", kind: "list", mediaType: "movie", value: "popular" },
  { id: "top-movies", name: "Top Rated Movies", slug: "top-movies", kind: "list", mediaType: "movie", value: "top-rated" },
  { id: "upcoming", name: "Upcoming", slug: "upcoming", kind: "list", mediaType: "movie", value: "upcoming" },
  { id: "popular-tv", name: "Popular TV Shows", slug: "popular-tv", kind: "list", mediaType: "tv", value: "popular" },
  { id: "top-tv", name: "Top Rated TV Shows", slug: "top-tv", kind: "list", mediaType: "tv", value: "top-rated" },
]

const studioCategories: CategoryDef[] = [
  { id: "warner-bros", name: "Warner Bros.", slug: "warner-bros", kind: "company", mediaType: "movie", value: "174" },
  { id: "sony-pictures", name: "Sony Pictures", slug: "sony-pictures", kind: "company", mediaType: "movie", value: "34" },
  { id: "disney", name: "Disney", slug: "disney", kind: "company", mediaType: "movie", value: "2" },
  { id: "universal", name: "Universal", slug: "universal", kind: "company", mediaType: "movie", value: "33" },
  { id: "paramount", name: "Paramount", slug: "paramount", kind: "company", mediaType: "movie", value: "4" },
  { id: "20th-century-studios", name: "20th Century Studios", slug: "20th-century-studios", kind: "company", mediaType: "movie", value: "25" },
  { id: "marvel", name: "Marvel", slug: "marvel", kind: "company", mediaType: "movie", value: "420" },
  { id: "dc", name: "DC", slug: "dc", kind: "company", mediaType: "movie", value: "128064" },
  { id: "pixar", name: "Pixar", slug: "pixar", kind: "company", mediaType: "movie", value: "3" },
  { id: "dreamworks", name: "DreamWorks", slug: "dreamworks", kind: "company", mediaType: "movie", value: "521" },
  { id: "a24", name: "A24", slug: "a24", kind: "company", mediaType: "movie", value: "199" },
]

const networkCategories: CategoryDef[] = [
  { id: "netflix", name: "Netflix", slug: "netflix", kind: "network", mediaType: "tv", value: "213" },
  { id: "hbo", name: "HBO", slug: "hbo", kind: "network", mediaType: "tv", value: "49" },
  { id: "apple-tv-plus", name: "Apple TV+", slug: "apple-tv-plus", kind: "network", mediaType: "tv", value: "2552" },
  { id: "prime-video", name: "Prime Video", slug: "prime-video", kind: "network", mediaType: "tv", value: "1024" },
  { id: "hulu", name: "Hulu", slug: "hulu", kind: "network", mediaType: "tv", value: "453" },
  { id: "peacock", name: "Peacock", slug: "peacock", kind: "network", mediaType: "tv", value: "3353" },
  { id: "cartoon-network", name: "Cartoon Network", slug: "cartoon-network", kind: "network", mediaType: "tv", value: "56" },
  { id: "nickelodeon", name: "Nickelodeon", slug: "nickelodeon", kind: "network", mediaType: "tv", value: "13" },
  { id: "adult-swim", name: "Adult Swim", slug: "adult-swim", kind: "network", mediaType: "tv", value: "80" },
]

async function resolveCategorySlug(slug: string, l: string, pageNum: number): Promise<{ data: any; cat: CategoryDef } | null> {
  const allStatic = [...listCategories, ...studioCategories, ...networkCategories]
  const cat = allStatic.find(c => c.slug === slug)
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
      const movieItems = movieDisc ? movieDisc.results.map(mapMovie) : []
      const tvItems = tvDisc ? tvDisc.results.map(mapTV) : []
      const allItems = [...movieItems, ...tvItems].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      const totalResults = (movieDisc?.total_results ?? 0) + (tvDisc?.total_results ?? 0)
      const totalPages = Math.max(movieDisc?.total_pages ?? 0, tvDisc?.total_pages ?? 0)
      return { data: { items: allItems, page: pageNum, totalPages, totalResults }, cat }
    }
    if (cat.kind === "network") {
      const disc = await tmdb.discoverTV({ with_networks: cat.value, page: pageNum }, l)
      return { data: { items: disc.results.map(mapTV), page: disc.page, totalPages: disc.total_pages, totalResults: disc.total_results }, cat }
    }
  }

  if (slug.startsWith("genre-")) {
    const genreId = slug.replace("genre-", "")
    const [movieDisc, tvDisc] = await Promise.all([
      tmdb.discoverMovie({ with_genres: genreId, page: pageNum }, l).catch(() => null),
      tmdb.discoverTV({ with_genres: genreId, page: pageNum }, l).catch(() => null),
    ])
    if (movieDisc && movieDisc.results.length > 0) {
      return { data: { items: movieDisc.results.map(mapMovie), page: movieDisc.page, totalPages: movieDisc.total_pages, totalResults: movieDisc.total_results }, cat: { id: slug, name: genreId, slug, kind: "genre", mediaType: "movie", value: genreId } }
    }
    if (tvDisc && tvDisc.results.length > 0) {
      return { data: { items: tvDisc.results.map(mapTV), page: tvDisc.page, totalPages: tvDisc.total_pages, totalResults: tvDisc.total_results }, cat: { id: slug, name: genreId, slug, kind: "genre", mediaType: "tv", value: genreId } }
    }
    return { data: { items: [], page: pageNum, totalPages: 1, totalResults: 0 }, cat: { id: slug, name: genreId, slug, kind: "genre", mediaType: "movie", value: genreId } }
  }

  return null
}

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
        const data = await media.movieDetail(args.id, l)
        return { ...data, __typename: "MovieDetail" }
      }
      const data = await media.tvDetail(args.id, l)
      return { ...data, __typename: "TVDetail" }
    },

    mediaCredits: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      if (args.type === "movie") return media.movieCredits(args.id, l)
      return media.tvCredits(args.id, l)
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

    categories: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      const [movieGenres, tvGenres] = await Promise.all([
        tmdb.movieGenres(l).catch(() => ({ genres: [] })),
        tmdb.tvGenres(l).catch(() => ({ genres: [] })),
      ])

      const genreMap = new Map<number, string>()
      for (const g of movieGenres.genres) genreMap.set(g.id, g.name)
      for (const g of tvGenres.genres) if (!genreMap.has(g.id)) genreMap.set(g.id, g.name)

      const genreItems = Array.from(genreMap, ([id, name]) => ({
        id: `genre-${id}`,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        slug: `genre-${name.toLowerCase().replace(/\s+/g, "-")}`,
        type: undefined as any,
        backdrop: null as string | null,
      }))

      const studios = [
        { id: "warner-bros", name: "Warner Bros.", slug: "warner-bros", type: "movie" as const, backdrop: null },
        { id: "sony-pictures", name: "Sony Pictures", slug: "sony-pictures", type: "movie" as const, backdrop: null },
        { id: "disney", name: "Disney", slug: "disney", type: "movie" as const, backdrop: null },
        { id: "universal", name: "Universal", slug: "universal", type: "movie" as const, backdrop: null },
        { id: "paramount", name: "Paramount", slug: "paramount", type: "movie" as const, backdrop: null },
        { id: "20th-century-studios", name: "20th Century Studios", slug: "20th-century-studios", type: "movie" as const, backdrop: null },
        { id: "marvel", name: "Marvel", slug: "marvel", type: "movie" as const, backdrop: null },
        { id: "dc", name: "DC", slug: "dc", type: "movie" as const, backdrop: null },
        { id: "pixar", name: "Pixar", slug: "pixar", type: "movie" as const, backdrop: null },
        { id: "dreamworks", name: "DreamWorks", slug: "dreamworks", type: "movie" as const, backdrop: null },
        { id: "a24", name: "A24", slug: "a24", type: "movie" as const, backdrop: null },
        { id: "netflix", name: "Netflix", slug: "netflix", type: "tv" as const, backdrop: null },
        { id: "hbo", name: "HBO", slug: "hbo", type: "tv" as const, backdrop: null },
        { id: "apple-tv-plus", name: "Apple TV+", slug: "apple-tv-plus", type: "tv" as const, backdrop: null },
        { id: "prime-video", name: "Prime Video", slug: "prime-video", type: "tv" as const, backdrop: null },
        { id: "hulu", name: "Hulu", slug: "hulu", type: "tv" as const, backdrop: null },
        { id: "peacock", name: "Peacock", slug: "peacock", type: "tv" as const, backdrop: null },
        { id: "cartoon-network", name: "Cartoon Network", slug: "cartoon-network", type: "tv" as const, backdrop: null },
        { id: "nickelodeon", name: "Nickelodeon", slug: "nickelodeon", type: "tv" as const, backdrop: null },
        { id: "adult-swim", name: "Adult Swim", slug: "adult-swim", type: "tv" as const, backdrop: null },
      ]

      return [
        { section: "Browse", items: [
          { id: "popular-movies", name: "Popular Movies", slug: "popular-movies", type: "movie", backdrop: null },
          { id: "top-movies", name: "Top Rated Movies", slug: "top-movies", type: "movie", backdrop: null },
          { id: "upcoming", name: "Upcoming", slug: "upcoming", type: "movie", backdrop: null },
          { id: "popular-tv", name: "Popular TV Shows", slug: "popular-tv", type: "tv", backdrop: null },
          { id: "top-tv", name: "Top Rated TV Shows", slug: "top-tv", type: "tv", backdrop: null },
        ]},
        { section: "Genres", items: genreItems },
        { section: "Studios", items: studios },
      ]
    },

    categoryCollection: async (_: any, args: Record<string, any>) => {
      const l = lang(args)
      const p = args.page ?? 1
      const slug = args.slug

      const result = await resolveCategorySlug(slug, l, p)
      if (!result) throw new Error("Category not found")

      const { data, cat } = result
      return { ...data, category: { id: cat.id, name: cat.name, slug: cat.slug } }
    },

    player: async (_: any, args: Record<string, any>) => {
      const { provider, kpId, tmdbId, imdbId, season, episode } = args

      if (provider === "alloha") {
        return getAllohaPlayerUrl(kpId ?? undefined, tmdbId ?? undefined, imdbId ?? undefined, season ?? undefined, episode ?? undefined)
      }

      if (provider === "collaps") {
        return getCollapsPlayerUrl(kpId ?? undefined, imdbId ?? undefined, season ?? undefined, episode ?? undefined)
      }

      if (provider === "cdn") {
        let resolvedCdnId: number | undefined = args.cdnId ?? undefined
        if (imdbId) resolvedCdnId = await resolveCdnId(imdbId, "imdb")
        else if (kpId) resolvedCdnId = await resolveCdnId(String(kpId), "kp")
        if (!resolvedCdnId) throw new Error("Missing cdnId, kpId, or imdbId")
        const data = await getPlayerData(resolvedCdnId, season ?? undefined, episode ?? undefined)
        return { provider: "CDN", ...data, type: "hls" }
      }

      throw new Error("Unknown provider")
    },

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

    watchLater: async (_: any, __: any, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.listWatchLater(userId)
    },

    syncProgress: async (_: any, __: any, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.getSyncProgress(userId)
    },

    loginUrl: (_: any, args: Record<string, any>) => {
      return neoid.getAuthorizeUrl(args.redirectUri ?? undefined)
    },

    torrentSearch: async (_: any, args: Record<string, any>) => {
      const { q, imdbId } = args
      if (!q && !imdbId) throw new Error("Missing search query (q or imdbId)")

      const params = new URLSearchParams()
      if (q) params.set("query", q)
      if (imdbId) params.set("imdb_id", imdbId)

      const res = await fetch(`${config.redapi.baseUrl}/torrents/search?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      })
      if (!res.ok) throw new Error("Torrent search failed")

      const data = await res.json() as { results: any[] }
      return data.results.map((t) => ({
        title: t.title,
        seeders: t.seeders,
        leechers: t.leechers,
        size: t.size,
        magnet: t.magnet,
        quality: t.quality,
        type: t.type,
      }))
    },

    supporters: () => [
      { id: 1, name: "Sophron Ragozin", type: ["service"], description: "Покупка и продления основного домена neowatch.ru", contributions: ["Домен neowatch.ru"], year: 2025, isActive: false },
      { id: 2, name: "Chernuha", type: ["code"], description: "Помощь с iOS версией", contributions: ["iOS разработка"], year: 2025, isActive: true },
      { id: 3, name: "Iwnuply", type: ["code"], description: "Создание докер контейнера для API и Frontend", contributions: ["Docker"], year: 2025, isActive: false },
    ],
  },
}
