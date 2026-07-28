import { Elysia, t } from "elysia"
import { userData } from "../services/user-data"
import { success } from "../lib/response"
import { UnauthorizedError } from "../lib/errors"
import { page } from "../lib/query"
import { authMiddleware } from "../middleware/auth"

export const favoriteRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/favorites", async ({ userId, query }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await userData.listFavorites(userId, page(query)))
  })

  .post("/api/v1/favorites/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await userData.addFavorite(userId, mediaId, "movie"))
  }, { params: t.Object({ mediaId: t.Numeric() }) })

  .delete("/api/v1/favorites/:mediaId", async ({ userId, params: { mediaId }, query }) => {
    if (!userId) throw new UnauthorizedError()
    const mediaType = (query as Record<string, string>)?.mediaType || "movie"
    await userData.removeFavorite(userId, Number(mediaId), mediaType)
    return success({ deleted: true })
  })

  .get("/api/v1/favorites/:mediaId/check", async ({ userId, params: { mediaId }, query }) => {
    if (!userId) throw new UnauthorizedError()
    const mediaType = (query as Record<string, string>)?.mediaType || "movie"
    return success({ isFavorite: await userData.checkFavorite(userId, Number(mediaId), mediaType) })
  })
