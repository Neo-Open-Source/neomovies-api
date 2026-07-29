import { Elysia, t } from "elysia"
import { userData } from "../services/user-data"
import { success } from "../lib/response"
import { UnauthorizedError } from "../lib/errors"
import { authMiddleware } from "../middleware/auth"

export const watchLaterRoutes = new Elysia()
  .use(authMiddleware)

  .get("/api/v1/watch-later", async ({ userId }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await userData.listWatchLater(userId))
  }, {
    detail: { tags: ["Watch Later"] },
  })

  .post("/api/v1/watch-later/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await userData.addWatchLater(userId, Number(mediaId)))
  }, { detail: { tags: ["Watch Later"] }, params: t.Object({ mediaId: t.Numeric() }) })

  .delete("/api/v1/watch-later/:mediaId", async ({ userId, params: { mediaId } }) => {
    if (!userId) throw new UnauthorizedError()
    await userData.removeWatchLater(userId, Number(mediaId))
    return success({ deleted: true })
  }, {
    detail: { tags: ["Watch Later"] },
  })

  .get("/api/v1/watch-later/:mediaId/check", async ({ userId, params: { mediaId } }) => {
    if (!userId) throw new UnauthorizedError()
    return success({ isSaved: await userData.checkWatchLater(userId, Number(mediaId)) })
  }, {
    detail: { tags: ["Watch Later"] },
  })
