import { Elysia, t } from "elysia"
import { userData } from "../services/user-data"
import { success, unauthorized } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const watchLaterRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/watch-later", async ({ userId }) => {
    if (!userId) return unauthorized()
    return success(await userData.listWatchLater(userId))
  })

  .post("/api/v1/watch-later/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    return success(await userData.addWatchLater(userId, Number(mediaId)))
  }, { params: t.Object({ mediaId: t.Numeric() }) })

  .delete("/api/v1/watch-later/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    await userData.removeWatchLater(userId, Number(mediaId))
    return success({ deleted: true })
  })

  .get("/api/v1/watch-later/:mediaId/check", async ({ userId, params: { mediaId } }) => {
    if (!userId) return unauthorized()
    return success({ isSaved: await userData.checkWatchLater(userId, Number(mediaId)) })
  })
