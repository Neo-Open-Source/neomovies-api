import { config } from "../config"
import { db } from "../db"

interface AllohaResponse {
  status: string
  data?: {
    id_kp?: number
    id_imdb?: string
    id_tmdb?: number
    name?: string
  }
}

export async function resolveIds(tmdbId: number, mediaType: "movie" | "tv" = "movie"): Promise<{ imdbId: string | null; kpId: number | null }> {
  const cached = await db.externalId.findUnique({ where: { tmdbId } })
  if (cached && cached.imdbId) return { imdbId: cached.imdbId, kpId: cached.kpId }
  if (cached && !cached.imdbId && Date.now() - cached.updatedAt.getTime() < 24 * 60 * 60 * 1000) {
    return { imdbId: cached.imdbId, kpId: cached.kpId }
  }

  if (!config.alloha.token) return { imdbId: null, kpId: null }

  try {
    const res = await fetch(
      `https://api.alloha.tv/?token=${config.alloha.token}&tmdb=${tmdbId}`,
      {
        headers: { Accept: "application/json" },
        tls: { rejectUnauthorized: false } as any,
      },
    )
    if (!res.ok) {
      await db.externalId.upsert({ where: { tmdbId }, update: { imdbId: null, kpId: null, mediaType }, create: { tmdbId, mediaType, imdbId: null, kpId: null } }).catch(() => {})
      return { imdbId: null, kpId: null }
    }

    const data = await res.json() as AllohaResponse
    if (data.status !== "success") return { imdbId: null, kpId: null }

    const imdbId = data.data?.id_imdb ?? null
    const kpId = data.data?.id_kp ?? null

    await db.externalId.upsert({
      where: { tmdbId },
      update: { imdbId, kpId, mediaType },
      create: { tmdbId, mediaType, imdbId, kpId },
    }).catch(e => console.error("Failed to cache external ID:", e))

    return { imdbId, kpId }
  } catch {
    return { imdbId: null, kpId: null }
  }
}
