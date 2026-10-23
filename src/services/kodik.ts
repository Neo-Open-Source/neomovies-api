import { config } from "../config"

export interface KodikTranslation {
  id: number
  title: string
  type: string
}

interface KodikRawSeason {
  link?: string
  episodes?: Record<string, string>
}

interface KodikRawResult {
  id: string
  type: string
  link?: string
  title?: string
  title_orig?: string
  other_title?: string
  translation?: KodikTranslation
  year?: number
  last_season?: number
  last_episode?: number
  episodes_count?: number
  kinopoisk_id?: string
  imdb_id?: string
  shikimori_id?: string
  quality?: string
  camrip?: boolean
  blocked_countries?: string[]
  blocked_seasons?: Record<string, unknown>
  seasons?: Record<string, KodikRawSeason>
}

interface KodikResponse {
  time?: string
  total?: number
  next_page?: string
  results?: KodikRawResult[]
  error?: string
}

export interface KodikEpisode {
  number: number
  link: string
}

export interface KodikSeason {
  number: number
  link: string | null
  episodes: KodikEpisode[]
}

export interface KodikTranslationGroup {
  id: number
  title: string
  type: string
  seasons: KodikSeason[]
  link: string | null
}

export interface KodikSearchResult {
  id: string
  type: string
  title: string
  titleOrig: string | null
  year: number | null
  lastSeason: number | null
  lastEpisode: number | null
  episodesCount: number | null
  quality: string | null
  camrip: boolean
  blockedCountries: string[]
  kinopoiskId: string | null
  imdbId: string | null
  shikimoriId: string | null
  translations: KodikTranslationGroup[]
}

export interface KodikPlaylist {
  provider: "Kodik"
  total: number
  results: KodikSearchResult[]
}

export type KodikIdType = "kinopoisk_id" | "imdb_id" | "shikimori_id"

function toHttps(link: string | undefined): string | null {
  if (!link) return null
  if (link.startsWith("//")) return `https:${link}`
  if (link.startsWith("http")) return link
  return `https://${link}`
}

function seasonNumber(value: string): number {
  return Number.parseInt(value, 10) || 0
}

function addSeason(group: KodikTranslationGroup, number: number, link: string | null): KodikSeason {
  const existing = group.seasons.find((s) => s.number === number)
  if (existing) {
    existing.link ??= link
    return existing
  }
  const season: KodikSeason = { number, link, episodes: [] }
  group.seasons.push(season)
  return season
}

function mergeResult(groups: Map<number, KodikTranslationGroup>, result: KodikRawResult): void {
  const translation = result.translation
  if (!translation) return

  let group = groups.get(translation.id)
  if (!group) {
    group = {
      id: translation.id,
      title: translation.title,
      type: translation.type,
      seasons: [],
      link: toHttps(result.link),
    }
    groups.set(translation.id, group)
  } else {
    group.link ??= toHttps(result.link)
  }

  for (const [key, rawSeason] of Object.entries(result.seasons ?? {})) {
    const season = addSeason(group, seasonNumber(key), toHttps(rawSeason.link))
    for (const [episodeKey, episodeLink] of Object.entries(rawSeason.episodes ?? {})) {
      const number = seasonNumber(episodeKey)
      const link = toHttps(episodeLink)
      if (!link) continue
      const existing = season.episodes.find((e) => e.number === number)
      if (existing) existing.link = link
      else season.episodes.push({ number, link })
    }
  }
}

function normalizeResults(raw: KodikRawResult[]): KodikSearchResult[] {
  const byTitle = new Map<string, KodikSearchResult>()
  const groupsByTitle = new Map<string, Map<number, KodikTranslationGroup>>()

  for (const result of raw) {
    let item = byTitle.get(result.id)
    if (!item) {
      item = {
        id: result.id,
        type: result.type,
        title: result.title ?? result.title_orig ?? result.id,
        titleOrig: result.title_orig ?? null,
        year: result.year ?? null,
        lastSeason: result.last_season ?? null,
        lastEpisode: result.last_episode ?? null,
        episodesCount: result.episodes_count ?? null,
        quality: result.quality ?? null,
        camrip: result.camrip ?? false,
        blockedCountries: result.blocked_countries ?? [],
        kinopoiskId: result.kinopoisk_id ?? null,
        imdbId: result.imdb_id ?? null,
        shikimoriId: result.shikimori_id ?? null,
        translations: [],
      }
      byTitle.set(result.id, item)
      groupsByTitle.set(result.id, new Map())
    }

    mergeResult(groupsByTitle.get(result.id)!, result)
  }

  for (const [id, groups] of groupsByTitle) {
    const item = byTitle.get(id)!
    item.translations = [...groups.values()].map((group) => ({
      ...group,
      seasons: group.seasons.sort((a, b) => a.number - b.number).map((season) => ({
        ...season,
        episodes: season.episodes.sort((a, b) => a.number - b.number),
      })),
    }))
  }

  return [...byTitle.values()].sort(
    (a, b) =>
      (a.lastSeason ?? 0) - (b.lastSeason ?? 0) ||
      (a.year ?? 0) - (b.year ?? 0) ||
      a.title.localeCompare(b.title),
  )
}

async function fetchKodik(params: Record<string, string | number | boolean>): Promise<KodikResponse> {
  if (!config.kodik.baseUrl || !config.kodik.token) throw new Error("not_configured")

  const query = new URLSearchParams({ token: config.kodik.token })
  for (const [key, value] of Object.entries(params)) {
    if (value === "" || value === undefined) continue
    query.set(key, String(value))
  }

  const res = await fetch(`${config.kodik.baseUrl.replace(/\/$/, "")}/search?${query.toString()}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`kodik request failed: HTTP ${res.status}`)

  const data = await res.json() as KodikResponse
  if (data.error) throw new Error(`kodik: ${data.error}`)
  return data
}

export async function searchKodik(title: string, limit = 20): Promise<KodikPlaylist> {
  const data = await fetchKodik({
    title,
    limit,
    with_seasons: true,
    with_episodes: true,
  })
  return {
    provider: "Kodik",
    total: data.total ?? 0,
    results: normalizeResults(data.results ?? []),
  }
}

export async function getKodikById(idType: KodikIdType, id: string): Promise<KodikPlaylist> {
  const data = await fetchKodik({
    [idType]: id,
    limit: 100,
    with_seasons: true,
    with_episodes: true,
  })
  return {
    provider: "Kodik",
    total: data.total ?? 0,
    results: normalizeResults(data.results ?? []),
  }
}

function linkFromTranslation(
  translation: KodikTranslationGroup,
  season?: number,
  episode?: number,
): string | null {
  if (season != null) {
    const targetSeason = translation.seasons.find((s) => s.number === season)
    if (!targetSeason) return null
    if (episode != null) {
      return targetSeason.episodes.find((e) => e.number === episode)?.link ?? null
    }
    return targetSeason.link ?? translation.link
  }
  return translation.link ?? translation.seasons[0]?.link ?? null
}

export function pickKodikLink(
  playlist: KodikPlaylist,
  translationId?: number,
  season?: number,
  episode?: number,
): string | null {
  const allTranslations = playlist.results.flatMap((item) => item.translations)

  if (translationId != null) {
    const match = allTranslations.find((t) => t.id === translationId)
    if (match) return linkFromTranslation(match, season, episode)
  }

  for (const item of playlist.results) {
    for (const translation of item.translations) {
      const link = linkFromTranslation(translation, season, episode)
      if (link) return link
    }
  }
  return null
}
