import { Elysia } from "elysia"
import { db } from "../db"
import { success, unauthorized, badRequest } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const syncRoutes = new Elysia({ prefix: "/api/v1/sync" })
  .use(authMiddleware)

  .get("/progress", async ({ userId }) => {
    if (!userId) return unauthorized()
    const items = await db.syncProgress.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } })
    return success(items.map((s) => ({
      mediaId: s.mediaId, mediaType: s.mediaType,
      season: s.season, episode: s.episode,
      progress: s.progress, updatedAt: s.updatedAt,
    })))
  })

  .put("/progress", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const { mediaId, mediaType, season, episode, progress } = body as any
    if (!mediaId || progress === undefined) return badRequest("Missing required fields: mediaId, progress")

    const record = await db.syncProgress.upsert({
      where: {
        userId_mediaId_mediaType_season_episode: {
          userId, mediaId, mediaType: mediaType || "movie",
          season: season ?? null, episode: episode ?? null,
        },
      },
      update: { progress },
      create: {
        userId, mediaId, mediaType: mediaType || "movie",
        season: season ?? null, episode: episode ?? null, progress,
      },
    })
    return success({
      mediaId: record.mediaId, mediaType: record.mediaType,
      season: record.season, episode: record.episode,
      progress: record.progress, updatedAt: record.updatedAt,
    })
  })

  .delete("/progress", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const { mediaId, mediaType, season, episode } = body as any
    await db.syncProgress.deleteMany({
      where: { userId, mediaId, mediaType: mediaType || "movie", season: season ?? null, episode: episode ?? null },
    })
    return success({ deleted: true })
  })

  .post("/progress/batch", async ({ userId, body }) => {
    if (!userId) return unauthorized()
    const items = (body as any)?.items || []
    if (!Array.isArray(items) || items.length === 0) return badRequest("Missing items array")

    const results = []
    for (const item of items) {
      const { mediaId, mediaType, season, episode, progress } = item
      if (!mediaId || progress === undefined) continue

      const record = await db.syncProgress.upsert({
        where: {
          userId_mediaId_mediaType_season_episode: {
            userId, mediaId, mediaType: mediaType || "movie",
            season: season ?? null, episode: episode ?? null,
          },
        },
        update: { progress: Math.max(progress, 0) },
        create: {
          userId, mediaId, mediaType: mediaType || "movie",
          season: season ?? null, episode: episode ?? null,
          progress: Math.max(progress, 0),
        },
      })
      results.push({
        mediaId: record.mediaId, mediaType: record.mediaType,
        season: record.season, episode: record.episode,
        progress: record.progress, updatedAt: record.updatedAt,
      })
    }

    return success({ items: results, count: results.length })
  })
