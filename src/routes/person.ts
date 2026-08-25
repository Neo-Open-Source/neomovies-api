import { Elysia, t } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { language } from "../lib/language"
import { page } from "../lib/query"

export const personRoutes = new Elysia()
  .get("/api/v1/person/:id", async ({ params: { id }, query }) =>
    success(await media.person(id, language(query))), {
    detail: { tags: ["People"], summary: "Person details" },
    params: t.Object({ id: t.Numeric() }),
  })
  .get("/api/v1/person/:id/credits", async ({ params: { id }, query }) =>
    success(await media.personCredits(id, page(query), language(query))), {
    detail: { tags: ["People"], summary: "Person filmography (paginated, movies + TV)" },
    params: t.Object({ id: t.Numeric() }),
  })
