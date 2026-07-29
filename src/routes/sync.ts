import { Elysia, t } from "elysia"
import { userData } from "../services/user-data"
import { success } from "../lib/response"
import { UnauthorizedError, BadRequestError } from "../lib/errors"
import { authMiddleware } from "../middleware/auth"

export const syncRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/sync/progress", async ({ userId }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await userData.getSyncProgress(userId))
  }, {
    detail: { tags: ["Sync"], summary: "Get Sync Progress" },
  })

  .put("/api/v1/sync/progress", async ({ userId, body }) => {
    if (!userId) throw new UnauthorizedError()
    const data = body as { mediaId?: number; mediaType?: string; season?: number; episode?: number; progress?: number }
    if (!data.mediaId || data.progress === undefined) throw new BadRequestError("Missing required fields: mediaId, progress")
    return success(await userData.upsertProgress(userId, {
      mediaId: data.mediaId, mediaType: data.mediaType,
      season: data.season, episode: data.episode, progress: data.progress,
    }))
  }, {
    detail: { tags: ["Sync"], summary: "Upsert Sync Progress" },
    body: t.Optional(t.Object({
      mediaId: t.Number(),
      mediaType: t.Optional(t.String()),
      season: t.Optional(t.Number()),
      episode: t.Optional(t.Number()),
      progress: t.Number(),
    })),
  })

  .delete("/api/v1/sync/progress", async ({ userId, body }) => {
    if (!userId) throw new UnauthorizedError()
    const data = body as { mediaId?: number; mediaType?: string; season?: number; episode?: number }
    if (!data.mediaId) throw new BadRequestError("Missing mediaId")
    await userData.deleteProgress(userId, {
      mediaId: data.mediaId, mediaType: data.mediaType,
      season: data.season, episode: data.episode,
    })
    return success({ deleted: true })
  }, {
    detail: { tags: ["Sync"], summary: "Delete Sync Progress" },
  })

  .post("/api/v1/sync/progress/batch", async ({ userId, body }) => {
    if (!userId) throw new UnauthorizedError()
    const { items } = body as { items?: any[] }
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestError("Missing items array")
    return success(await userData.batchUpsertProgress(userId, items))
  }, {
    detail: { tags: ["Sync"], summary: "Batch Sync Progress" },
  })
