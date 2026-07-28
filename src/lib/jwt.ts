import { sign, verify } from "jsonwebtoken"
import { config } from "../config"

export interface JwtPayload {
  userId: string
  neoId: string
  type: "access" | "refresh"
}

export function signAccessToken(payload: { userId: string; neoId: string }): string {
  return sign(
    { ...payload, type: "access" },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  )
}

export function signRefreshToken(payload: { userId: string; neoId: string }): string {
  return sign(
    { ...payload, type: "refresh" },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
}

export function verifyAccessToken(token: string): JwtPayload {
  const payload = verify(token, config.jwt.secret) as JwtPayload
  if (payload.type !== "access") throw new Error("Invalid token type")
  return payload
}

export function verifyRefreshToken(token: string): JwtPayload {
  const payload = verify(token, config.jwt.refreshSecret) as JwtPayload
  if (payload.type !== "refresh") throw new Error("Invalid token type")
  return payload
}
