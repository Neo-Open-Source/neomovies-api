import { Elysia } from "elysia"
import { success } from "../lib/response"

export const webhookRoutes = new Elysia({ prefix: "/api/v1/webhooks" })

  .post("/neo-id", async ({ body }) => {
    const payload = body as Record<string, unknown>
    console.log("Neo ID webhook received:", JSON.stringify(payload))

    // Process Neo ID events (user.update, user.delete, etc.)
    const event = payload.event as string
    const userData = payload.user as Record<string, unknown> | undefined

    switch (event) {
      case "user.delete":
        if (userData?.id) {
          // Don't delete user immediately, just log
          console.log(`User ${userData.id} deleted from Neo ID`)
        }
        break
      default:
        console.log(`Unhandled Neo ID event: ${event}`)
    }

    return success({ received: true })
  })
