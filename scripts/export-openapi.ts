import { writeFileSync } from "node:fs"

const placeholders: Record<string, string> = {
  DATABASE_URL: "postgresql://localhost:5432/neowatch",
  TMDB_API_KEY: "build",
  TMDB_ACCESS_TOKEN: "build",
  NEO_ID_CLIENT_ID: "build",
  NEO_ID_CLIENT_SECRET: "build",
  NEO_ID_REDIRECT_URI: "https://example.com/api/v1/auth/callback",
}

for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ||= value
}

const { app } = await import("../src/app")

const response = await app.handle(new Request("http://localhost/playground/json"))
if (!response.ok) {
  throw new Error(`OpenAPI generation failed: HTTP ${response.status}`)
}

const spec = await response.text()
writeFileSync(new URL("../docs/static/openapi.json", import.meta.url), spec)
console.log("Wrote docs/static/openapi.json")
