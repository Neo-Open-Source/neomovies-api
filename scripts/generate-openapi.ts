import { writeFileSync } from "fs"

process.env.DATABASE_URL = "postgresql://localhost:5432/dev"
process.env.TMDB_API_KEY = "dev"
process.env.TMDB_ACCESS_TOKEN = "dev"
process.env.NEO_ID_CLIENT_ID = "dev"
process.env.NEO_ID_CLIENT_SECRET = "dev"
process.env.NEO_ID_REDIRECT_URI = "http://localhost:3000/api/v1/auth/callback"

const { app } = await import("../src/app")

const port = 0
const server = Bun.serve({ port: 0, fetch: app.fetch })
const address = server.url

const res = await fetch(`${address}playground/json`)
const spec = await res.json()
server.stop()

writeFileSync("docs/static/openapi.json", JSON.stringify(spec, null, 2))
console.log("OpenAPI spec saved to docs/static/openapi.json")
