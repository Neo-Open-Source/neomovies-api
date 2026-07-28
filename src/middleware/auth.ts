import { Elysia } from "elysia"
import { verifyAccessToken } from "../lib/jwt"

export const authMiddleware = new Elysia()
  .derive({ as: "global" }, ({ headers }: { headers: Record<string, string | undefined> }) => {
    const authHeader = headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return { userId: null as string | null, neoId: null as string | null }
    }

    try {
      const token = authHeader.slice(7)
      const payload = verifyAccessToken(token)
      return { userId: payload.userId, neoId: payload.neoId }
    } catch {
      return { userId: null as string | null, neoId: null as string | null }
    }
  })
