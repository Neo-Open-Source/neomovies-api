import { Elysia, t } from "elysia"
import { success } from "../lib/response"

const blockedIds = new Set<number>()

export const contentRoutes = new Elysia()

  .get("/api/v1/content/blocked/:id", async ({ params: { id } }) =>
    success({ blocked: blockedIds.has(id), tmdbId: id }), {
    params: t.Object({ id: t.Numeric() }),
  })
