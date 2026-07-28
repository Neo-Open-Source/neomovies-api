import { Elysia, t } from "elysia"
import { db } from "../db"
import { success, unauthorized } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const favoriteRoutes = new Elysia({ prefix: "/api/v1/favorites" })
  .use(authMiddleware)

  .get("/", async ({ userId, query }) => {
    if (!userId) return unauthorized()
    const page = parseInt((query as any)?.page || "1")
    const limit = 20
    const [items, total] = await Promise.all([
      db.favorite.findMany({
        where: { userId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.favorite.count({ where: { userId } }),
    ])
    return success({
      items: items.map((f) => ({ mediaId: f.mediaId, mediaType: f.mediaType, createdAt: f.createdAt })),
      page, totalPages: Math.ceil(total / limit), totalResults: total,
    })
  })

  .post("/:mediaId", async ({ userId, params: { mediaId }, body }) => {
    if (!userId) return unauthorized()
    const mediaType = ((body as any)?.mediaType as string) || "movie"
    const fav = await db.favorite.upsert({
      where: { userId_mediaId_mediaType: { userId, mediaId, mediaType } },
      update: {},
      create: { userId, mediaId, mediaType },
    })
    return success({ id: fav.id, mediaId: fav.mediaId, mediaType: fav.mediaType })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })

  .delete("/:mediaId", async ({ userId, params: { mediaId }, query }) => {
    if (!userId) return unauthorized()
    const mediaType = (query as any)?.mediaType as string || "movie"
    await db.favorite.deleteMany({ where: { userId, mediaId, mediaType } })
    return success({ deleted: true })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })

  .get("/:mediaId/check", async ({ userId, params: { mediaId }, query }) => {
    if (!userId) return unauthorized()
    const mediaType = (query as any)?.mediaType as string || "movie"
    const fav = await db.favorite.findUnique({
      where: { userId_mediaId_mediaType: { userId, mediaId, mediaType } },
    })
    return success({ isFavorite: !!fav })
  }, {
    params: t.Object({ mediaId: t.Numeric() }),
  })
