import { getKodikById } from "./kodik"
import { isAllohaAvailable, isCollapsAvailable } from "./players"

export interface PlayerAvailability {
  kodik: boolean
  alloha: boolean
  collaps: boolean
}

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function getPlayerAvailability(opts: {
  kpId?: number
  tmdbId?: number
  imdbId?: string
}): Promise<PlayerAvailability> {
  const { kpId, tmdbId, imdbId } = opts

  const kodik = (async () => {
    if (!kpId && !imdbId) return false
    try {
      const playlist = kpId
        ? await getKodikById("kinopoisk_id", String(kpId))
        : await getKodikById("imdb_id", String(imdbId))
      return playlist.results.length > 0
    } catch {
      return false
    }
  })()

  const [kodikAvailable, alloha, collaps] = await Promise.all([
    withTimeout(kodik, false),
    withTimeout(isAllohaAvailable(kpId, tmdbId, imdbId), false),
    withTimeout(isCollapsAvailable(kpId, imdbId), false),
  ])

  return { kodik: kodikAvailable, alloha, collaps }
}
