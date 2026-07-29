import { Elysia, t } from "elysia"
import { db } from "../db"
import { success } from "../lib/response"

export const webhookRoutes = new Elysia({ prefix: "/api/v1/webhooks" })

  .post("/neo-id", async ({ body }) => {
    const event = body?.event as string | undefined
    const userData = body?.user as Record<string, unknown> | undefined
    const userId = userData?.id as string | undefined

    if (event === "user.delete" && userId) {
      await Promise.all([
        db.favorite.deleteMany({ where: { userId } }),
        db.watchLater.deleteMany({ where: { userId } }),
        db.syncProgress.deleteMany({ where: { userId } }),
        db.user.delete({ where: { id: userId } }).catch(e => console.error("Failed to delete user:", e)),
      ])
    }

    return success({ received: true })
  }, {
    detail: { tags: ["Webhooks"] },
    body: t.Object({
      event: t.Optional(t.String()),
      user: t.Optional(t.Object({
        id: t.Optional(t.String()),
      })),
    }),
  })
