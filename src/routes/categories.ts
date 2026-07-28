import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { media } from "../services/media"
import { success } from "../lib/response"
import { NotFoundError } from "../lib/errors"
import { page } from "../lib/query"
import { language, type Language } from "../lib/language"
import { mapMovie, mapTV, paginate } from "../lib/mappers"

interface CategoryDef {
  id: string
  name: string
  slug: string
  kind: "list" | "genre" | "company"
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
  { id: "netflix", name: "Netflix", slug: "netflix", kind: "company", mediaType: "movie", value: "191" },
  { id: "warner-bros", name: "Warner Bros.", slug: "warner-bros", kind: "company", mediaType: "movie", value: "174" },
  { id: "sony-pictures", name: "Sony Pictures", slug: "sony-pictures", kind: "company", mediaType: "movie", value: "34" },
  { id: "pixar", name: "Pixar", slug: "pixar", kind: "company", mediaType: "movie", value: "3" },
  { id: "paramount", name: "Paramount Pictures", slug: "paramount", kind: "company", mediaType: "movie", value: "4" },
  { id: "prime", name: "Amazon Studios", slug: "prime", kind: "company", mediaType: "movie", value: "10234" },
  { id: "universal", name: "Universal Pictures", slug: "universal", kind: "company", mediaType: "movie", value: "33" },
  { id: "disney", name: "Walt Disney Pictures", slug: "disney", kind: "company", mediaType: "movie", value: "2" },
  { id: "marvel", name: "Marvel Studios", slug: "marvel", kind: "company", mediaType: "movie", value: "420" },
  { id: "dc", name: "DC Films", slug: "dc", kind: "company", mediaType: "movie", value: "128064" },
]

async function fetchGenreCategories(lang: Language): Promise<CategoryDef[]> {
  const [movieGenres, tvGenres] = await Promise.all([
    tmdb.movieGenres(lang).catch(() => ({ genres: [] })),
    tmdb.tvGenres(lang).catch(() => ({ genres: [] })),
  ])

  const movie = movieGenres.genres.map(g => ({
    id: `genre-movie-${g.id}`, name: g.name, slug: `genre-movie-${g.name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "genre" as const, mediaType: "movie" as const, value: String(g.id),
  }))

  const tv = tvGenres.genres.map(g => ({
    id: `genre-tv-${g.id}`, name: g.name, slug: `genre-tv-${g.name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "genre" as const, mediaType: "tv" as const, value: String(g.id),
  }))

  return [...movie, ...tv]
}

export const categoryRoutes = new Elysia()

  .get("/api/v1/categories", async ({ query }) => {
    const lang = language(query)
    const genres = await fetchGenreCategories(lang)

    const all = [
      { section: "Browse", items: listCategories },
      { section: "Genres", items: genres },
      { section: "Studios", items: studioCategories },
    ]

    return success(all.map(s => ({
      section: s.section,
      items: s.items.map(c => ({ id: c.id, name: c.name, slug: c.slug, type: c.mediaType })),
    })))
  })

  .get("/api/v1/collection/:slug", async ({ params: { slug }, query }) => {
    const lang = language(query)
    const pageNum = page(query)
    const genres = await fetchGenreCategories(lang)
    const all = [...listCategories, ...genres, ...studioCategories]
    const cat = all.find(c => c.slug === slug)
    if (!cat) throw new NotFoundError("Category")

    let data: any
    const mapper = cat.mediaType === "movie" ? mapMovie : mapTV

    if (cat.kind === "list") {
      data = await media.list(cat.mediaType, cat.value, pageNum, lang)
    } else if (cat.kind === "genre") {
      const discover = cat.mediaType === "movie"
        ? await tmdb.discoverMovie({ with_genres: cat.value }, lang)
        : await tmdb.discoverTV({ with_genres: cat.value }, lang)
      data = paginate(discover.results.map(mapper as any), discover.page, discover.total_pages, discover.total_results)
    } else if (cat.kind === "company") {
      const discover = await tmdb.discoverMovie({ with_companies: cat.value }, lang)
      data = paginate(discover.results.map(mapper as any), discover.page, discover.total_pages, discover.total_results)
    } else {
      throw new NotFoundError("Category")
    }

    return success({ ...data, category: { id: cat.id, name: cat.name, slug: cat.slug } })
  }, {
    params: t.Object({ slug: t.String() }),
  })
