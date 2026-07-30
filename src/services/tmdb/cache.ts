interface CacheEntry<T> {
  data: T
  expires: number
}

export class TMDBCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private readonly ttl: number

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttl = ttlMs
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    if (Date.now() > entry.expires) {
      this.store.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      expires: Date.now() + this.ttl,
    })
  }
}
