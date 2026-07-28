import { config } from "../config"

interface OMDbRating {
  source: string
  value: string
}

interface OMDbResponse {
  imdbID: string
  imdbRating: string
  imdbVotes: string
  Ratings: OMDbRating[]
}

class OMDbCache {
  private store = new Map<string, { data: string | null; expires: number }>()
  private ttl = 30 * 60 * 1000

  get(key: string): string | null | undefined {
    const entry = this.store.get(key)
    if (!entry || Date.now() > entry.expires) {
      this.store.delete(key)
      return undefined
    }
    return entry.data
  }

  set(key: string, data: string | null): void {
    this.store.set(key, { data, expires: Date.now() + this.ttl })
  }
}

class OMDbClient {
  private cache = new OMDbCache()
  private apiKey = config.omdb.apiKey

  async getRating(imdbId: string): Promise<{ imdbRating: string | null; imdbVotes: string | null }> {
    if (!this.apiKey || !imdbId) return { imdbRating: null, imdbVotes: null }

    const cached = this.cache.get(imdbId)
    if (cached !== undefined) return { imdbRating: cached, imdbVotes: null }

    try {
      const res = await fetch(`${config.omdb.baseUrl}?i=${imdbId}&apikey=${this.apiKey}`)
      if (!res.ok) return { imdbRating: null, imdbVotes: null }

      const data = await res.json() as OMDbResponse
      if (data.imdbRating && data.imdbRating !== "N/A") {
        this.cache.set(imdbId, data.imdbRating)
        return { imdbRating: data.imdbRating, imdbVotes: data.imdbVotes || null }
      }

      this.cache.set(imdbId, null)
      return { imdbRating: null, imdbVotes: null }
    } catch {
      return { imdbRating: null, imdbVotes: null }
    }
  }
}

export const omdb = new OMDbClient()
