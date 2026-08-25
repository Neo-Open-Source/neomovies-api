import { Elysia, t } from "elysia"
import { config } from "../config"
import { neoid } from "../services/neoid"
import { success } from "../lib/response"
import { UnauthorizedError, BadRequestError } from "../lib/errors"
import { authMiddleware } from "../middleware/auth"

export const authRoutes = new Elysia({ prefix: "/api/v1/auth" })
  .use(authMiddleware)

  .get("/login", ({ query }) => {
    const { redirect_uri, code_challenge, code_challenge_method, state } = query
    const extra = {
      ...(code_challenge ? { code_challenge } : {}),
      ...(code_challenge_method ? { code_challenge_method } : {}),
      ...(state ? { state } : {}),
    }
    return success({ url: neoid.getAuthorizeUrl(redirect_uri, extra) })
  }, {
    detail: { tags: ["Auth"], summary: "Neo ID Login" },
    query: t.Object({
      redirect_uri: t.Optional(t.String()),
      code_challenge: t.Optional(t.String()),
      code_challenge_method: t.Optional(t.String()),
      state: t.Optional(t.String()),
    }),
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
  }, {
    detail: { tags: ["Auth"], summary: "Auth Callback" },
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
  }, {
    detail: { tags: ["Auth"], summary: "Mobile Auth Callback" },
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
  }, {
    detail: { tags: ["Auth"], summary: "Refresh Tokens" },
  })

  .get("/profile", async ({ userId, userEmail, userRole, headers }) => {
    if (!userId) throw new UnauthorizedError()
    const authHeader = headers.authorization
    if (!authHeader?.startsWith("Bearer ")) throw new UnauthorizedError()

    try {
      const user = await neoid.getUser(authHeader.slice(7))
      return success({
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
      })
    } catch {
      // Token verified by middleware — fall back to JWT claims if Neo ID is briefly down
      return success({
        id: userId,
        email: userEmail,
        displayName: null,
        avatar: null,
        role: userRole,
      })
    }
  }, {
    detail: { tags: ["Auth"], summary: "Get User Profile" },
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
  }, {
    detail: { tags: ["Auth"], summary: "Update User Profile" },
  })

  .get("/refresh-tokens", async ({ userId, headers }) => {
    if (!userId) throw new UnauthorizedError()
    return success(await neoid.listRefreshTokens(headers.authorization || ""))
  }, {
    detail: { tags: ["Auth"], summary: "List Refresh Tokens" },
    headers: t.Object({ authorization: t.String() }),
  })

  .post("/refresh-tokens/revoke", async ({ userId, headers, body }) => {
    if (!userId) throw new UnauthorizedError()
    const { refreshToken } = body as { refreshToken?: string }
    if (!refreshToken) throw new BadRequestError("Missing refreshToken")
    await neoid.revokeRefreshToken(refreshToken, headers.authorization || "")
    return success({ revoked: true })
  }, {
    detail: { tags: ["Auth"], summary: "Revoke Refresh Token" },
  })

  .post("/refresh-tokens/revoke-all", async ({ userId, headers }) => {
    if (!userId) throw new UnauthorizedError()
    await neoid.revokeAllRefreshTokens(headers.authorization || "")
    return success({ revoked: true })
  }, {
    detail: { tags: ["Auth"], summary: "Revoke All Refresh Tokens" },
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
  }, {
    detail: { tags: ["Auth"], summary: "Logout" },
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
  }, {
    detail: { tags: ["Auth"], summary: "Delete Account" },
  })
