import { describe, expect, it, beforeAll, afterAll } from "bun:test"

const BASE = "http://localhost:3001"

let server: any

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://localhost:5432/test"
  process.env.TMDB_API_KEY = "test"
  process.env.TMDB_ACCESS_TOKEN = "test"
  process.env.NEO_ID_CLIENT_ID = "test"
  process.env.NEO_ID_CLIENT_SECRET = "test"
  process.env.NEO_ID_REDIRECT_URI = "http://localhost:3001/api/v1/auth/callback"

  const { app } = await import("../app")
  server = Bun.serve({ port: 3001, fetch: app.fetch })
})

afterAll(() => {
  server?.stop()
})

describe("health endpoint", () => {
  it("returns 200 with status ok", async () => {
    const res = await fetch(`${BASE}/api/v1/health`)
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBeTrue()
    expect(body.data.status).toBe("ok")
  })
})

describe("swagger docs", () => {
  it("serves swagger UI at /playground", async () => {
    const res = await fetch(`${BASE}/playground`)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain("api-reference")
  })
})

describe("404 handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`${BASE}/api/v1/nonexistent`)
    expect(res.status).toBe(404)
    const body = await res.json() as any
    expect(body.success).toBeFalse()
    expect(body.error).toBe("Not Found")
  })
})
