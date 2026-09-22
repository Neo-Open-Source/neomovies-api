import { verifyAccessToken } from "../lib/jwt"

export interface GraphQLContext {
  userId: string | null
  userEmail: string | null
  userRole: string | null
  authorization: string | null
}

export async function createContext(request: Request): Promise<GraphQLContext> {
  const authHeader = request.headers.get("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, userEmail: null, userRole: null, authorization: null }
  }

  try {
    const token = authHeader.slice(7)
    const payload = await verifyAccessToken(token)
    return {
      userId: payload.sub,
      userEmail: payload.email,
      userRole: payload.role,
      authorization: authHeader,
    }
  } catch {
    return { userId: null, userEmail: null, userRole: null, authorization: null }
  }
}

export function requireAuth(ctx: GraphQLContext): string {
  if (!ctx.userId) throw new Error("Unauthorized")
  return ctx.userId
}
