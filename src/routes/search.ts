import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { language } from "../lib/language"

export const searchRoutes = new Elysia()
  .get("/api/v1/search", async ({ query }) => {
    const q = query as Record<string, string | undefined>
    return success(await media.search(q, language(q)))
  }, {
    detail: { tags: ["Search"], summary: "Multi Search" },
    query: t.Object({
      q: t.Optional(t.String({ description: "Text search query" })),
      type: t.Optional(t.String({ description: "Filter by type: movie, tv, or multi" })),
      genre: t.Optional(t.String({ description: "Genre ID(s) comma-separated" })),
      year: t.Optional(t.String({ description: "Exact release year" })),
      yearFrom: t.Optional(t.String({ description: "Year range start" })),
      yearTo: t.Optional(t.String({ description: "Year range end" })),
      rating: t.Optional(t.String({ description: "Minimum vote average" })),
      ratingFrom: t.Optional(t.String({ description: "Rating range start" })),
      ratingTo: t.Optional(t.String({ description: "Rating range end" })),
      keyword: t.Optional(t.String({ description: "TMDB keyword ID" })),
      country: t.Optional(t.String({ description: "Original language (e.g. en, uk)" })),
      sort_by: t.Optional(t.String({ description: "Sort field (e.g. popularity.desc, vote_average.desc)" })),
      page: t.Optional(t.String({ description: "Page number" })),
      language: t.Optional(t.String({ description: "Language (e.g. en-US, uk-UA, ru-RU)" })),
    }),
  })
