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

class NeoIdClient {
  private clientId = config.neoId.clientId
  private clientSecret = config.neoId.clientSecret

  getAuthorizeUrl(redirectUri?: string): string {
    const redirect = redirectUri || config.neoId.redirectUri
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: config.neoId.scope,
    })
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

    const json = await res.json() as Record<string, unknown>
    return {
      access_token: (json.access_token || json.accessToken) as string,
      token_type: (json.token_type || "Bearer") as string,
      expires_in: json.expires_in as number,
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

    const json = await res.json() as Record<string, unknown>
    return {
      access_token: (json.access_token || json.accessToken) as string,
      token_type: (json.token_type || "Bearer") as string,
      expires_in: json.expires_in as number,
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

    return res.json() as Promise<NeoIdUserResponse>
  }
}

export const neoid = new NeoIdClient()
