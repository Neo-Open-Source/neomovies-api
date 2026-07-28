import { Elysia, t } from "elysia"
import { config } from "../config"
import { neoid } from "../services/neoid"
import { success } from "../lib/response"
import { UnauthorizedError, BadRequestError } from "../lib/errors"
import { authMiddleware } from "../middleware/auth"

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .use(authMiddleware)

  .get("/login", ({ query }) => {
    const { redirect_uri } = query
    return success({ url: neoid.getAuthorizeUrl(redirect_uri) })
  }, {
    query: t.Object({ redirect_uri: t.Optional(t.String()) }),
  })

  .get("/callback", async ({ query }) => {
    const { code, redirect_uri } = query as { code?: string; redirect_uri?: string }
    if (!code) throw new BadRequestError("Missing code")

    const tokens = await neoid.exchangeCode(code, redirect_uri as string)
    const redirect = redirect_uri || config.neoId.redirectUri
    const frontendUrl = redirect.replace(/\/api\/v1\/auth\/callback$/, "").replace(/\/auth\/callback$/, "")

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl || "/"}`,
        "Set-Cookie": [
          `neo_id_access=${tokens.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${tokens.expires_in}`,
          `neo_id_refresh=${tokens.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
        ].join(", "),
      },
    })
  })

  .get("/mobile-callback", async ({ query }) => {
    const { code, redirect_uri } = query as { code?: string; redirect_uri?: string }
    if (!code) throw new BadRequestError("Missing code")

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
    if (!refreshToken) throw new BadRequestError("Missing refresh token")

    try {
      const tokens = await neoid.refreshTokens(refreshToken)
      return success({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
      })
    } catch {
      throw new UnauthorizedError("Invalid refresh token")
    }
  })

  .get("/profile", async ({ userId, userEmail, userRole }) => {
    if (!userId) throw new UnauthorizedError()
    return success({ id: userId, email: userEmail, role: userRole })
  })

  .put("/profile", async ({ userId, headers, body }) => {
    if (!userId) throw new UnauthorizedError()
    const { name, avatar } = body as { name?: string; avatar?: string }

    const authHeader = headers.authorization
    const res = await fetch(`${config.neoId.issuer}/api/v1/user/profile`, {
      method: "PUT",
      headers: {
        Authorization: authHeader || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, avatar }),
    })
    if (!res.ok) throw new BadRequestError("Failed to update profile")

    const updated = await res.json()
    return success(updated)
  })

  .get("/refresh-tokens", async ({ userId, headers }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await neoid.listRefreshTokens(headers.authorization || ""))
  }, {
    headers: t.Object({ authorization: t.String() }),
  })

  .post("/refresh-tokens/revoke", async ({ userId, body }) => {
    if (!userId) throw new UnauthorizedError()
    const { refreshToken } = body as { refreshToken?: string }
    if (!refreshToken) throw new BadRequestError("Missing refreshToken")
    await neoid.revokeRefreshToken(refreshToken)
    return success({ revoked: true })
  })

  .post("/refresh-tokens/revoke-all", async ({ userId, headers }) => {
    if (!userId) throw new UnauthorizedError()
    await neoid.revokeAllRefreshTokens(headers.authorization || "")
    return success({ revoked: true })
  })

  .post("/logout", async ({ headers }) => {
    const authHeader = headers.authorization
    if (authHeader?.startsWith("Bearer ")) {
      await fetch(`${config.neoId.issuer}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: authHeader },
      }).catch(e => console.error("Neo ID logout failed:", e))
    }
    return success({ ok: true })
  })

  .delete("/account", async ({ userId, headers }) => {
    if (!userId) throw new UnauthorizedError()
    const authHeader = headers.authorization
    const res = await fetch(`${config.neoId.issuer}/api/v1/user/delete`, {
      method: "DELETE",
      headers: { Authorization: authHeader || "", "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) throw new UnauthorizedError("Failed to delete account")
    return success({ deleted: true })
  })
