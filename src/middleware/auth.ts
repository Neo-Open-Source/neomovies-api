import { Elysia } from "elysia"
import { verifyAccessToken } from "../lib/jwt"
import { db } from "../db"

export const authMiddleware = new Elysia()
  .derive({ as: "global" }, async ({ headers }: { headers: Record<string, string | undefined> }) => {
    const authHeader = headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return { userId: null as string | null, userEmail: null as string | null, userRole: null as string | null }
    }

    try {
      const token = authHeader.slice(7)
      const payload = await verifyAccessToken(token)

      void db.user.upsert({
        where: { id: payload.sub },
        update: { email: payload.email, role: payload.role },
        create: { id: payload.sub, email: payload.email, role: payload.role },
      }).catch(() => {})

      return {
        userId: payload.sub,
        userEmail: payload.email,
        userRole: payload.role,
      }
    } catch {
      return { userId: null as string | null, userEmail: null as string | null, userRole: null as string | null }
    }
  })
