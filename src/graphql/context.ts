import { GraphQLError } from "graphql"
import { resolveAuthIdentity } from "../lib/auth"

export interface GraphQLContext {
  userId: string | null
  userEmail: string | null
  userRole: string | null
  authorization: string | null
}

export async function createContext(request: Request): Promise<GraphQLContext> {
  const authorization = request.headers.get("Authorization")
  const identity = await resolveAuthIdentity(authorization)

  if (!identity) {
    return { userId: null, userEmail: null, userRole: null, authorization: null }
  }

  return { ...identity, authorization }
}

/**
 * GraphQLError (not plain Error) so Yoga does not mask it as
 * "Unexpected error." and can surface HTTP 401 via extensions.http.
 */
export function unauthorized(message = "Unauthorized"): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "UNAUTHORIZED", http: { status: 401 } },
  })
}

export function badRequest(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "BAD_USER_INPUT", http: { status: 400 } },
  })
}

export function internalError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "INTERNAL_SERVER_ERROR", http: { status: 500 } },
  })
}

export function requireAuth(ctx: GraphQLContext): string {
  if (!ctx.userId) throw unauthorized()
  return ctx.userId
}
