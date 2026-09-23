import { Elysia } from "elysia"
import { resolveAuthIdentity } from "../lib/auth"

export const authMiddleware = new Elysia()
  .derive({ as: "global" }, async ({ headers }) => {
    const identity = await resolveAuthIdentity(headers.authorization)
    return {
      userId: identity?.userId ?? null,
      userEmail: identity?.userEmail ?? null,
      userRole: identity?.userRole ?? null,
    }
  })
