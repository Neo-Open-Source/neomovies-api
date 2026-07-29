import { Elysia } from "elysia"
import { media } from "../services/media"
import { success } from "../lib/response"
import { language } from "../lib/language"

export const searchRoutes = new Elysia()
  .get("/api/v1/search", async ({ query }) => {
    const q = query as Record<string, string | undefined>
    return success(await media.search(q, language(q)))
  }, {
    detail: { tags: ["Search"] },
  })
