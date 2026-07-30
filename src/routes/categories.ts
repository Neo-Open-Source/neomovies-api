import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { media } from "../services/media"
import { success } from "../lib/response"
import { NotFoundError } from "../lib/errors"
import { page } from "../lib/query"
import { language, type Language } from "../lib/language"
import { mapMovie, mapTV, paginate } from "../lib/mappers"
import { genreNames, enrichGenreNames } from "../services/media/utils"

interface CategoryDef {
  id: string
  name: string
  slug: string
  kind: "list" | "genre" | "company" | "network"
  mediaType: "movie" | "tv"
  value: string
  backdrop?: string | null
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
  { id: "dreamworks", name: "DreamWorks", slug: "dreamworks", kind: "company", mediaType: "movie", value: "24" },
  { id: "legendary", name: "Legendary", slug: "legendary", kind: "company", mediaType: "movie", value: "379" },
  { id: "a24", name: "A24", slug: "a24", kind: "company", mediaType: "movie", value: "199" },
  { id: "amazon-studios", name: "Amazon Studios", slug: "amazon-studios", kind: "company", mediaType: "movie", value: "10234" },
  { id: "apple-studios", name: "Apple Studios", slug: "apple-studios", kind: "company", mediaType: "movie", value: "2552" },
]

const networkCategories: CategoryDef[] = [
  { id: "netflix", name: "Netflix", slug: "netflix", kind: "network", mediaType: "tv", value: "213" },
  { id: "hbo", name: "HBO", slug: "hbo", kind: "network", mediaType: "tv", value: "49" },
  { id: "apple-tv-plus", name: "Apple TV+", slug: "apple-tv-plus", kind: "network", mediaType: "tv", value: "2552" },
  { id: "disney-plus", name: "Disney+", slug: "disney-plus", kind: "network", mediaType: "tv", value: "2739" },
  { id: "prime-video", name: "Prime Video", slug: "prime-video", kind: "network", mediaType: "tv", value: "1024" },
  { id: "hulu", name: "Hulu", slug: "hulu", kind: "network", mediaType: "tv", value: "453" },
  { id: "paramount-plus", name: "Paramount+", slug: "paramount-plus", kind: "network", mediaType: "tv", value: "4335" },
  { id: "peacock", name: "Peacock", slug: "peacock", kind: "network", mediaType: "tv", value: "5807" },
  { id: "cartoon-network", name: "Cartoon Network", slug: "cartoon-network", kind: "network", mediaType: "tv", value: "56" },
  { id: "nickelodeon", name: "Nickelodeon", slug: "nickelodeon", kind: "network", mediaType: "tv", value: "87" },
  { id: "adult-swim", name: "Adult Swim", slug: "adult-swim", kind: "network", mediaType: "tv", value: "377" },
]

function capitalizeFirst(name: string): string {
  if (!name) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-")
}

async function fetchGenreCategories(lang: Language): Promise<CategoryDef[]> {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdb.movieGenres(lang).catch(() => ({ genres: [] })),
    tmdb.tvGenres(lang).catch(() => ({ genres: [] })),
  ])

  const genreMap = new Map<number, string>()
  for (const g of movieGenres.genres) genreMap.set(g.id, g.name)
  for (const g of tvGenres.genres) if (!genreMap.has(g.id)) genreMap.set(g.id, g.name)

  const genres = Array.from(genreMap, ([id, name]) => ({ id, name }))

  const withBackdrops = await Promise.all(
    genres.map(async (g) => {
      let tmdbId: number | null = null
      let mediaType: "movie" | "tv" = "movie"

      try {
        const movieResult = await tmdb.discoverMovie(
          { with_genres: String(g.id), page: 1, sort_by: "popularity.desc" },
          lang
        )
        const items = movieResult.results.filter(r => r.backdrop_path)
        if (items.length > 0) {
          const pick = items[Math.floor(Math.random() * items.length)]
          tmdbId = pick.id
        }
      } catch {}

      if (!tmdbId) {
        try {
          const tvResult = await tmdb.discoverTV(
            { with_genres: String(g.id), page: 1, sort_by: "popularity.desc" },
            lang
          )
          const items = tvResult.results.filter(r => r.backdrop_path)
          if (items.length > 0) {
            const pick = items[Math.floor(Math.random() * items.length)]
            tmdbId = pick.id
            mediaType = "tv"
          }
        } catch {}
      }

      const backdrop = tmdbId
        ? `/api/v1/images/backdrop/${tmdbId}?type=${mediaType}`
        : null

      return {
        id: `genre-${g.id}`,
        name: capitalizeFirst(g.name),
        slug: `genre-${slugify(g.name)}`,
        kind: "genre" as const,
        mediaType: "movie" as const,
        value: String(g.id),
        backdrop,
      }
    })
  )

  return withBackdrops
}

export const categoryRoutes = new Elysia()

  .get("/api/v1/categories", async ({ query, set }) => {
    const lang = language(query)
    const genres = await fetchGenreCategories(lang)

    const all = [
      { section: "Browse", items: listCategories },
      { section: "Genres", items: genres },
      { section: "Studios", items: [...studioCategories, ...networkCategories] },
    ]

    set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"

    return success(all.map(s => ({
      section: s.section,
      items: s.items.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        ...(s.section === "Genres" ? {} : { type: c.mediaType }),
        ...(c.backdrop ? { backdrop: c.backdrop } : {}),
      })),
    })))
  }, {
    detail: { tags: ["Categories"], summary: "List Categories" },
    query: t.Object({ language: t.Optional(t.String()) }),
  })

  .get("/api/v1/collection/:id", async ({ params: { id }, query, set }) => {
    const lang = language(query)
    const pageNum = page(query)
    const genres = await fetchGenreCategories(lang)
    const all = [...listCategories, ...genres, ...studioCategories, ...networkCategories]
    const cat = all.find(c => c.id === id)
    if (!cat) throw new NotFoundError("Category")

    set.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=3600"

    let data: any

    if (cat.kind === "list") {
      data = await media.list(cat.mediaType, cat.value, pageNum, lang)
    } else if (cat.kind === "genre") {
      const [movieDiscover, tvDiscover] = await Promise.all([
        tmdb.discoverMovie({ with_genres: cat.value, page: pageNum }, lang).catch(() => null),
        tmdb.discoverTV({ with_genres: cat.value, page: pageNum }, lang).catch(() => null),
      ])

      if (movieDiscover && movieDiscover.results.length > 0) {
        const items = movieDiscover.results.map(mapMovie)
        enrichGenreNames(items, await genreNames("movie", lang), movieDiscover.results)
        data = paginate(items, movieDiscover.page, movieDiscover.total_pages, movieDiscover.total_results)
      } else if (tvDiscover && tvDiscover.results.length > 0) {
        const items = tvDiscover.results.map(mapTV)
        enrichGenreNames(items, await genreNames("tv", lang), tvDiscover.results)
        data = paginate(items, tvDiscover.page, tvDiscover.total_pages, tvDiscover.total_results)
      } else {
        data = paginate([], pageNum, 1, 0)
      }
    } else if (cat.kind === "company") {
      const discover = await tmdb.discoverMovie({ with_companies: cat.value }, lang)
      const items = discover.results.map(mapMovie)
      enrichGenreNames(items, await genreNames("movie", lang), discover.results)
      data = paginate(items, discover.page, discover.total_pages, discover.total_results)
    } else if (cat.kind === "network") {
      const discover = await tmdb.discoverTV({ with_networks: cat.value }, lang)
      const items = discover.results.map(mapTV)
      enrichGenreNames(items, await genreNames("tv", lang), discover.results)
      data = paginate(items, discover.page, discover.total_pages, discover.total_results)
    } else {
      throw new NotFoundError("Category")
    }

    const clean = data.items.map((i: any) => {
      const { certification, ...rest } = i
      if (certification) rest.certification = certification
      return rest
    })

    return success({ ...data, items: clean, category: { id: cat.id, name: cat.name, slug: cat.slug } })
  }, {
    detail: { tags: ["Categories"], summary: "Get Collection" },
    params: t.Object({ id: t.String() }),
    query: t.Object({ language: t.Optional(t.String()), page: t.Optional(t.String()) }),
  })
