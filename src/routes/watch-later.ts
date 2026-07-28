import { Elysia, t } from "elysia"
import { db } from "../db"
import { success, unauthorized } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const watchLaterRoutes = new Elysia({ prefix: "/api/v1/watch-later" })
  .use(authMiddleware)

  .get("/", async ({ userId, query }) => {
    if (!userId) return unauthorized()
    const page = parseInt((query as any)?.page || "1")
    const limit = 20
    const [items, total] = await Promise.all([
      db.watchLater.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.watchLater.count({ where: { userId } }),
    ])
    return success({
      items: items.map((w) => ({ mediaId: w.mediaId, createdAt: w.createdAt })),
      page, totalPages: Math.ceil(total / limit), totalResults: total,
    })
  })

  .post("/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    const item = await db.watchLater.upsert({
      where: { userId_mediaId: { userId, mediaId } },
      update: {},
      create: { userId, mediaId },
    })
    return success({ id: item.id, mediaId: item.mediaId })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })

  .delete("/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    await db.watchLater.deleteMany({ where: { userId, mediaId } })
    return success({ deleted: true })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })

  .get("/:mediaId/check", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    const item = await db.watchLater.findUnique({
      where: { userId_mediaId: { userId, mediaId } },
    })
    return success({ isSaved: !!item })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })
