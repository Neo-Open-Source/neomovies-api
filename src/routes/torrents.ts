import { Elysia, t } from "elysia"
import { success } from "../lib/response"
import { BadRequestError } from "../lib/errors"
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
    const q = query?.q
    const imdbId = query?.imdb_id
    if (!q && !imdbId) throw new BadRequestError("Missing search query (q or imdb_id)")

    const params = new URLSearchParams()
    if (q) params.set("query", q)
    if (imdbId) params.set("imdb_id", imdbId)

    const res = await fetch(`${config.redapi.baseUrl}/torrents/search?${params.toString()}`, {
      headers: { "Content-Type": "application/json" },
    })

    if (!res.ok) {
      throw new BadRequestError("Torrent search failed")
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
  }, {
    detail: { tags: ["Torrents"], summary: "Search Torrents" },
    query: t.Object({
      q: t.Optional(t.String()),
      imdb_id: t.Optional(t.String()),
    }),
  })
