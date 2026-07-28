import { Elysia } from "elysia"
import { db } from "../db"
import { success } from "../lib/response"

export const webhookRoutes = new Elysia({ prefix: "/api/v1/webhooks" })

  .post("/neo-id", async ({ body }) => {
    const payload = body as Record<string, unknown>
    const event = payload.event as string
    const userData = payload.user as Record<string, unknown> | undefined
    const userId = userData?.id as string | undefined

    if (event === "user.delete" && userId) {
      await Promise.all([
        db.favorite.deleteMany({ where: { userId } }),
        db.watchLater.deleteMany({ where: { userId } }),
        db.syncProgress.deleteMany({ where: { userId } }),
        db.user.delete({ where: { id: userId } }).catch(() => {}),
      ])
    }

    return success({ received: true })
  })
