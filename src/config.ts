export const config = {
  port: parseInt(process.env.PORT || "3000"),
  databaseUrl: process.env.DATABASE_URL!,

  tmdb: {
    apiKey: process.env.TMDB_API_KEY!,
    accessToken: process.env.TMDB_ACCESS_TOKEN!,
    baseUrl: "https://api.themoviedb.org/3",
    imageBaseUrl: "https://image.tmdb.org/t/p",
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessExpiresIn: "15m",
    refreshExpiresIn: "30d",
  },

  neoId: {
    clientId: process.env.NEO_ID_CLIENT_ID!,
    clientSecret: process.env.NEO_ID_CLIENT_SECRET!,
    redirectUri: process.env.NEO_ID_REDIRECT_URI!,
    mobileRedirectUri: process.env.NEO_ID_MOBILE_REDIRECT_URI!,
    authUrl: "https://id.neome.uk/auth",
    tokenUrl: "https://id.neome.uk/api/token",
    userUrl: "https://id.neome.uk/api/user",
  },

  redapi: {
    token: process.env.REDAPI_TOKEN!,
    baseUrl: "https://redapi.com/api",
  },
} as const

export function assertConfig(): void {
  const required = [
    ["DATABASE_URL", config.databaseUrl],
    ["TMDB_API_KEY", config.tmdb.apiKey],
    ["TMDB_ACCESS_TOKEN", config.tmdb.accessToken],
    ["JWT_SECRET", config.jwt.secret],
    ["JWT_REFRESH_SECRET", config.jwt.refreshSecret],
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
