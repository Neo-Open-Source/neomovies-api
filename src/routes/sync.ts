import { Elysia } from "elysia"
import { userData } from "../services/user-data"
import { success, unauthorized, badRequest } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const syncRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/sync/progress", async ({ userId }) => {
    if (!userId) return unauthorized()
    return success(await userData.getSyncProgress(userId))
  })

  .put("/api/v1/sync/progress", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const data = body as { mediaId?: number; mediaType?: string; season?: number; episode?: number; progress?: number }
    if (!data.mediaId || data.progress === undefined) return badRequest("Missing required fields: mediaId, progress")
    return success(await userData.upsertProgress(userId, {
      mediaId: data.mediaId, mediaType: data.mediaType,
      season: data.season, episode: data.episode, progress: data.progress,
    }))
  })

  .delete("/api/v1/sync/progress", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const data = body as { mediaId?: number; mediaType?: string; season?: number; episode?: number }
    await userData.deleteProgress(userId, {
      mediaId: data.mediaId!, mediaType: data.mediaType,
      season: data.season, episode: data.episode,
    })
    return success({ deleted: true })
  })

  .post("/api/v1/sync/progress/batch", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const { items } = body as { items?: any[] }
    if (!Array.isArray(items) || items.length === 0) return badRequest("Missing items array")
    return success(await userData.batchUpsertProgress(userId, items))
  })
