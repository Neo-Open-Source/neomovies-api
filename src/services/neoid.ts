import { config } from "../config"

interface OAuth2TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  id_token: string
}

interface NeoIdUserResponse {
  id: string
  email: string
  displayName?: string
  avatar?: string
  role: string
}

/** Neo ID wraps payloads as `{ ok: true, data: T }`. */
function unwrapData<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json && (json as { ok?: boolean }).ok !== false) {
    return (json as { data: T }).data
  }
  return json as T
}

class NeoIdClient {
  private clientId = config.neoId.clientId
  private clientSecret = config.neoId.clientSecret

  /**
   * Builds the Neo ID authorize URL. Extra params (PKCE code_challenge,
   * state, …) are appended verbatim so SPAs can start a public-client flow
   * and exchange the code from the browser.
   */
  getAuthorizeUrl(redirectUri?: string, extra?: Record<string, string>): string {
    const redirect = redirectUri || config.neoId.redirectUri
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: config.neoId.scope,
    })
    for (const [key, value] of Object.entries(extra ?? {})) {
      if (value) params.set(key, value)
    }
    return `${config.neoId.authorizeUrl}?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<OAuth2TokenResponse> {
    const redirect = redirectUri || config.neoId.redirectUri
    const res = await fetch(config.neoId.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Neo ID token exchange failed: ${res.status} ${text}`)
    }

    const json = unwrapData<Record<string, unknown>>(await res.json())
    return {
      access_token: (json.access_token || json.accessToken) as string,
      token_type: (json.token_type || "Bearer") as string,
      expires_in: Number(json.expires_in ?? 3600),
      refresh_token: (json.refresh_token || json.refreshToken) as string,
      id_token: (json.id_token || json.idToken) as string,
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuth2TokenResponse> {
    const res = await fetch(config.neoId.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Neo ID refresh failed: ${res.status} ${text}`)
    }

    const json = unwrapData<Record<string, unknown>>(await res.json())
    return {
      access_token: (json.access_token || json.accessToken) as string,
      token_type: (json.token_type || "Bearer") as string,
      expires_in: Number(json.expires_in ?? 3600),
      refresh_token: (json.refresh_token || json.refreshToken) as string,
      id_token: (json.id_token || json.idToken) as string,
    }
  }

  async getUser(accessToken: string): Promise<NeoIdUserResponse> {
    const res = await fetch(config.neoId.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`Neo ID user fetch failed: ${res.status}`)
    }

    const profile = unwrapData<Record<string, unknown>>(await res.json())
    return {
      id: String(profile.id ?? profile.sub ?? ""),
      email: String(profile.email ?? ""),
      displayName: (profile.displayName ?? profile.name) as string | undefined,
      avatar: (profile.avatar ?? profile.picture) as string | undefined,
      role: String(profile.role ?? "user"),
    }
  }

  async listRefreshTokens(authHeader: string): Promise<{ id: string; deviceName?: string; createdAt: string }[]> {
    // Neo ID exposes active sessions, not a separate oauth2 token list
    const res = await fetch(`${config.neoId.issuer}/api/v1/sessions`, {
      headers: { Authorization: authHeader },
    })
    if (!res.ok) return []
    const sessions = unwrapData<{ id: string; deviceInfo?: string; createdAt: string }[]>(await res.json())
    return (sessions ?? []).map((s) => ({
      id: s.id,
      deviceName: s.deviceInfo,
      createdAt: s.createdAt,
    }))
  }

  async revokeRefreshToken(sessionId: string, authHeader: string): Promise<void> {
    await fetch(`${config.neoId.issuer}/api/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    })
  }

  async revokeAllRefreshTokens(authHeader: string): Promise<void> {
    await fetch(`${config.neoId.issuer}/api/v1/sessions`, {
      method: "DELETE",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
    })
  }
}

export const neoid = new NeoIdClient()
