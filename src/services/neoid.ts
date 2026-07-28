import { config } from "../config"

interface NeoIdTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

interface NeoIdUserResponse {
  id: string
  email?: string
  username?: string
  avatar_url?: string
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
      scope: "openid profile email",
    })
    return `${config.neoId.authUrl}?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<NeoIdTokenResponse> {
    const redirect = redirectUri || config.neoId.redirectUri
    const res = await fetch(config.neoId.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
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

    return res.json() as Promise<NeoIdTokenResponse>
  }

  async getUser(accessToken: string): Promise<NeoIdUserResponse> {
    const res = await fetch(config.neoId.userUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`Neo ID user fetch failed: ${res.status}`)
    }

    return res.json() as Promise<NeoIdUserResponse>
  }
}

export const neoid = new NeoIdClient()
