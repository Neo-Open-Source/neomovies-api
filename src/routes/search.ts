import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { language } from "../lib/language"

export const searchRoutes = new Elysia()
  .get("/api/v1/search", async ({ query: raw }) => {
    const query: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (v !== undefined) query[k] = String(v)
    }
    return success(await media.search(query, language(query)))
  }, {
    detail: {
      tags: ["Search"],
      summary: "Multi Search"
    },
    query: t.Object({
      q: t.Optional(t.String({ description: "Text search query" })),
      type: t.Optional(
        t.Union([
          t.Literal("movie"),
          t.Literal("tv"),
          t.Literal("multi")
        ], { description: "Filter by type" })
      ),

      genre: t.Optional(t.String({ description: "Genre ID(s) comma-separated" })),
      year: t.Optional(t.Numeric({ description: "Exact release year" })),
      yearFrom: t.Optional(t.Numeric({ description: "Year range start" })),
      yearTo: t.Optional(t.Numeric({ description: "Year range end" })),

      rating: t.Optional(t.Numeric({ description: "Minimum vote average" })),
      ratingFrom: t.Optional(t.Numeric({ description: "Rating range start" })),
      ratingTo: t.Optional(t.Numeric({ description: "Rating range end" })),

      keyword: t.Optional(t.String({ description: "TMDB keyword ID" })),
      country: t.Optional(t.String({ description: "Original language (e.g. en, uk)" })),

      sort_by: t.Optional(t.String({ description: "Sort field (e.g. popularity.desc, vote_average.desc)" })),

      page: t.Optional(t.Numeric({ default: 1, description: "Page number" })),
      language: t.Optional(t.String({ default: "ru-RU", description: "Language (e.g. en-US, uk-UA, ru-RU)" })),
    }),
  })
