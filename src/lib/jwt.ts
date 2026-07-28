import { createRemoteJWKSet, jwtVerify } from "jose"
import { config } from "../config"

export interface JwtPayload {
  sub: string
  email: string
  role: string
  session_id?: string
}

const JWKS = createRemoteJWKSet(new URL(config.neoId.jwksUrl))

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.neoId.issuer,
  })

  return {
    sub: payload.sub!,
    email: payload.email as string,
    role: payload.role as string,
    session_id: payload.session_id as string | undefined,
  }
}
