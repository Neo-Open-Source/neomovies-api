export const config = {
  port: parseInt(process.env.PORT || "3000"),
  publicUrl: process.env.PUBLIC_API_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL!,

  tmdb: {
    apiKey: process.env.TMDB_API_KEY!,
    accessToken: process.env.TMDB_ACCESS_TOKEN!,
    baseUrl: "https://api.themoviedb.org/3",
    imageBaseUrl: "https://image.tmdb.org/t/p",
  },

  neoId: {
    clientId: process.env.NEO_ID_CLIENT_ID!,
    clientSecret: process.env.NEO_ID_CLIENT_SECRET!,
    redirectUri: process.env.NEO_ID_REDIRECT_URI!,
    issuer: process.env.NEO_ID_URL || "https://id.neome.uk",
    get authorizeUrl() { return `${this.issuer}/api/v1/oauth2/authorize` },
    get tokenUrl() { return `${this.issuer}/api/v1/oauth2/token` },
    get jwksUrl() { return `${this.issuer}/.well-known/jwks.json` },
    get userInfoUrl() { return `${this.issuer}/api/v1/user/profile` },
    scope: "openid profile email",
  },

  redapi: {
    baseUrl: process.env.REDAPI_URL || "https://redapi.com/api",
  },

  alloha: {
    token: process.env.ALLOHA_TOKEN || "",
  },

  collaps: {
    host: process.env.COLLAPS_API_HOST || "",
    token: process.env.COLLAPS_TOKEN || "",
  },

  cdn: {
    baseUrl: "https://api.rstprgapipt.com/balancer-api/proxy/playlists/catalog-api",
    iframeUrl: "https://api.rstprgapipt.com/balancer-api/iframe",
    token: process.env.CDN_TOKEN || "",
    pl: process.env.CDN_PL || "",
  },

  cronSecret: process.env.CRON_SECRET || "",
} as const

export function assertConfig(): void {
  const required = [
    ["DATABASE_URL", config.databaseUrl],
    ["TMDB_API_KEY", config.tmdb.apiKey],
    ["TMDB_ACCESS_TOKEN", config.tmdb.accessToken],
    ["NEO_ID_CLIENT_ID", config.neoId.clientId],
    ["NEO_ID_CLIENT_SECRET", config.neoId.clientSecret],
    ["NEO_ID_REDIRECT_URI", config.neoId.redirectUri],
  ] as const

  const missing = required.filter(([_, v]) => !v)
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.map(([k]) => k).join(", ")}`
    )
  }
}
