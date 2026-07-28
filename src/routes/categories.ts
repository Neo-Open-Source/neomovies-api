import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success, notFound } from "../lib/response"
import { page } from "../lib/query"
import { language } from "../lib/language"

interface Category {
  id: string
  name: string
  slug: string
  type: "movie" | "tv"
  endpoint: string
}

const categories: Category[] = [
  { id: "popular-movies", name: "Popular Movies", slug: "popular-movies", type: "movie", endpoint: "popular" },
  { id: "top-movies", name: "Top Rated Movies", slug: "top-movies", type: "movie", endpoint: "top-rated" },
  { id: "upcoming", name: "Upcoming", slug: "upcoming", type: "movie", endpoint: "upcoming" },
  { id: "popular-tv", name: "Popular TV Shows", slug: "popular-tv", type: "tv", endpoint: "popular" },
  { id: "top-tv", name: "Top Rated TV Shows", slug: "top-tv", type: "tv", endpoint: "top-rated" },
]

export const categoryRoutes = new Elysia()

  .get("/api/v1/categories", () =>
    success(categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, type: c.type }))))

  .get("/api/v1/collection/:slug", async ({ params: { slug }, query }) => {
    const cat = categories.find(c => c.slug === slug)
    if (!cat) return notFound("Category")

    const data = await media.list(cat.type, cat.endpoint, page(query), language(query))
    return success({ ...data, category: { id: cat.id, name: cat.name, slug: cat.slug } })
  }, {
    params: t.Object({ slug: t.String() }),
  })
