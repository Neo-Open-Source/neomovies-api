import { Elysia, t } from "elysia"
import { config } from "../config"
import { neoid } from "../services/neoid"
import { success, unauthorized, badRequest } from "../lib/response"
import { authMiddleware } from "../middleware/auth"

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .use(authMiddleware)

  .get("/login", ({ query }) => {
    const redirectUri = query?.redirect_uri as string | undefined
    const url = neoid.getAuthorizeUrl(redirectUri)
    return success({ url })
  }, {
    query: t.Object({
      redirect_uri: t.Optional(t.String()),
    }),
  })

  .get("/callback", async ({ query }) => {
    const { code, redirect_uri } = query as { code?: string; redirect_uri?: string }
    if (!code) return badRequest("Missing code")

    const tokens = await neoid.exchangeCode(code, redirect_uri as string)

    const redirect = redirect_uri || config.neoId.redirectUri
    const frontendUrl = redirect.replace(/\/api\/v1\/auth\/callback$/, "").replace(/\/auth\/callback$/, "")

    const setCookieAccess = `neo_id_access=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${tokens.expires_in}`
    const setCookieRefresh = `neo_id_refresh=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl || "/"}`,
        "Set-Cookie": [setCookieAccess, setCookieRefresh].join(", "),
      },
    })
  })

  .get("/mobile-callback", async ({ query }) => {
    const { code, redirect_uri } = query as { code?: string; redirect_uri?: string }
    if (!code) return badRequest("Missing code")

    const tokens = await neoid.exchangeCode(code, redirect_uri as string)

    const user = await neoid.getUser(tokens.access_token).catch(() => null)

    return success({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresIn: tokens.expires_in,
      user: user ? { id: user.id, email: user.email, displayName: user.displayName, avatar: user.avatar } : undefined,
    })
  })

  .post("/refresh", async ({ body }) => {
    const { refreshToken } = body as { refreshToken?: string }
    if (!refreshToken) return badRequest("Missing refresh token")

    try {
      const tokens = await neoid.refreshTokens(refreshToken)
      return success({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
      })
    } catch {
      return unauthorized("Invalid refresh token")
    }
  })

  .get("/profile", async ({ userId, userEmail, userRole }) => {
    if (!userId) return unauthorized()
    return success({
      id: userId,
      email: userEmail,
      role: userRole,
    })
  })

  .post("/logout", async ({ headers }) => {
    const authHeader = headers.authorization
    if (authHeader?.startsWith("Bearer ")) {
      try {
        await fetch(`${config.neoId.issuer}/api/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: authHeader },
        })
      } catch {
        // ignore neo-id logout errors
      }
    }

    return success({ ok: true })
  })

  .delete("/account", async ({ userId, headers }) => {
    if (!userId) return unauthorized()
    const authHeader = headers.authorization
    const res = await fetch(`${config.neoId.issuer}/api/v1/user/delete`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) return unauthorized("Failed to delete account")
    return success({ deleted: true })
  })
