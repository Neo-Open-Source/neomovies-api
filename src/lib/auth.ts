import { db } from "../db"
import { verifyAccessToken } from "./jwt"

export interface AuthIdentity {
  userId: string
  userEmail: string | null
  userRole: string | null
}

/**
 * Resolves the bearer token into a verified identity and ensures the User row
 * exists (FK source for favorites / watch-later / sync). Returns null for
 * missing or invalid tokens — callers decide whether that means "anonymous"
 * or 401.
 */
export async function resolveAuthIdentity(
  authorization: string | null | undefined,
): Promise<AuthIdentity | null> {
  if (!authorization?.startsWith("Bearer ")) return null

  try {
    const payload = await verifyAccessToken(authorization.slice(7))

    try {
      await db.user.upsert({
        where: { id: payload.sub },
        update: { email: payload.email, role: payload.role },
        create: { id: payload.sub, email: payload.email, role: payload.role },
      })
    } catch (e) {
      console.error("Failed to upsert user:", e)
    }

    return {
      userId: payload.sub,
      userEmail: payload.email ?? null,
      userRole: payload.role ?? null,
    }
  } catch {
    return null
  }
}
