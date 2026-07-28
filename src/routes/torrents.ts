import { Elysia } from "elysia"
import { success, badRequest } from "../lib/response"
import { config } from "../config"

interface RedAPITorrent {
  title: string
  seeders: number
  leechers: number
  size: number
  magnet: string
  quality: string
  type: string
}

export const torrentRoutes = new Elysia()

  .get("/api/v1/torrents/search", async ({ query }) => {
    const { q, imdb_id } = query as { q?: string; imdb_id?: string }
    if (!q && !imdb_id) return badRequest("Missing search query (q or imdb_id)")

    const params = new URLSearchParams()
    if (q) params.set("query", q)
    if (imdb_id) params.set("imdb_id", imdb_id)

    const res = await fetch(`${config.redapi.baseUrl}/torrents/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${config.redapi.token}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      return badRequest("Torrent search failed")
    }

    const data = await res.json() as { results: RedAPITorrent[] }
    return success(data.results.map((t) => ({
      title: t.title,
      seeders: t.seeders,
      leechers: t.leechers,
      size: t.size,
      magnet: t.magnet,
      quality: t.quality,
      type: t.type,
    })))
  })
