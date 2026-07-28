import { Elysia, t } from "elysia"
import { config } from "../config"
import { neoid } from "../services/neoid"
import { db } from "../db"
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt"
import { success, unauthorized, badRequest, notFound } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .use(authMiddleware)

  .get("/neo-id/login", ({ query }) => {
    const redirectUri = query?.redirect_uri as string | undefined
    const url = neoid.getAuthorizeUrl(redirectUri)
    return success({ url })
  }, {
    query: t.Object({
      redirect_uri: t.Optional(t.String()),
    }),
  })

  .get("/neo-id/callback", async ({ query }) => {
    const { code, redirect_uri } = query as { code?: string; redirect_uri?: string }
    if (!code) return badRequest("Missing code")

    const tokenRes = await neoid.exchangeCode(code, redirect_uri as string)
    const neoUser = await neoid.getUser(tokenRes.access_token)

    let user = await db.user.findUnique({ where: { neoId: neoUser.id } })
    if (!user) {
      user = await db.user.create({
        data: {
          neoId: neoUser.id,
          email: neoUser.email,
          username: neoUser.username,
          avatarUrl: neoUser.avatar_url,
        },
      })
    } else {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          email: neoUser.email ?? user.email,
          username: neoUser.username ?? user.username,
          avatarUrl: neoUser.avatar_url ?? user.avatarUrl,
        },
      })
    }

    const accessToken = signAccessToken({ userId: user.id, neoId: user.neoId })
    const refreshToken = signRefreshToken({ userId: user.id, neoId: user.neoId })

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    return success({
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        neoId: user.neoId,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl,
      },
    })
  })

  .get("/neo-id/mobile-callback", async ({ query }) => {
    const { code } = query as { code?: string }
    if (!code) return badRequest("Missing code")

    const tokenRes = await neoid.exchangeCode(code, config.neoId.mobileRedirectUri)
    const neoUser = await neoid.getUser(tokenRes.access_token)

    let user = await db.user.findUnique({ where: { neoId: neoUser.id } })
    if (!user) {
      user = await db.user.create({
        data: {
          neoId: neoUser.id,
          email: neoUser.email,
          username: neoUser.username,
          avatarUrl: neoUser.avatar_url,
        },
      })
    }

    const accessToken = signAccessToken({ userId: user.id, neoId: user.neoId })
    const refreshToken = signRefreshToken({ userId: user.id, neoId: user.neoId })

    await db.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    return success({
      accessToken,
      refreshToken,
      expiresIn: 900,
    })
  })

  .post("/refresh", async ({ body }) => {
    const { refreshToken } = body as { refreshToken?: string }
    if (!refreshToken) return badRequest("Missing refresh token")

    const stored = await db.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.revokedAt) return unauthorized("Invalid refresh token")
    if (stored.expiresAt < new Date()) {
      await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })
      return unauthorized("Refresh token expired")
    }

    let payload
    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      return unauthorized("Invalid refresh token")
    }

    const user = await db.user.findUnique({ where: { id: payload.userId } })
    if (!user) return notFound("User")

    await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })

    const newAccessToken = signAccessToken({ userId: user.id, neoId: user.neoId })
    const newRefreshToken = signRefreshToken({ userId: user.id, neoId: user.neoId })

    await db.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    return success({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    })
  })

  .get("/profile", async ({ userId }) => {
    if (!userId) return unauthorized()
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return notFound("User")
    return success({
      id: user.id,
      neoId: user.neoId,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    })
  })

  .post("/revoke", async ({ body, userId }) => {
    if (!userId) return unauthorized()
    const { refreshToken } = body as { refreshToken?: string }
    if (!refreshToken) return badRequest("Missing refresh token")

    const stored = await db.refreshToken.findUnique({ where: { token: refreshToken } })
    if (stored && stored.userId === userId) {
      await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })
    }

    return success({ revoked: true })
  })

  .post("/revoke-all", async ({ userId }) => {
    if (!userId) return unauthorized()
    await db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return success({ revoked: true })
  })

  .delete("/account", async ({ userId }) => {
    if (!userId) return unauthorized()
    await db.user.delete({ where: { id: userId } })
    return success({ deleted: true })
  })
