import { config } from "../config"

interface ContentInfo {
  id: number
  title: string
  hasMultipleEpisodes: boolean
  trailerUrls?: string[]
}

interface Episode {
  id: number
  title?: string
  order: number
  season: { id: number; order: number }
  episodeVariants: { filepath: string; title?: string }[]
}

export interface CdnEpisodeDto {
  season: number
  episode: number
  title: string
  m3u8Url: string
}

export interface CdnVideoDto {
  id: string
  title: string
  isSeries: boolean
  m3u8Url: string
  season: number | null
  episode: number | null
  episodes: CdnEpisodeDto[]
}

const CDN_BASE = config.cdn.baseUrl
const CDN_IFRAME = config.cdn.iframeUrl
const CDN_TOKEN = config.cdn.token
const CDN_PL = config.cdn.pl

function cdnHeaders(): Record<string, string> {
  return {
    "DLE-API-TOKEN": CDN_TOKEN,
    "Iframe-Request-Id": "7f2a4c1b-ca44-4858-b6ab-71894c7bb1aa",
  }
}

async function getContentInfo(cdnId: number): Promise<ContentInfo> {
  const url = `${CDN_BASE}/contents/${cdnId}`
  const res = await fetch(url, { headers: cdnHeaders() })
  if (!res.ok) throw new Error(`CDN API error: ${res.status}`)
  return res.json() as Promise<ContentInfo>
}

async function getEpisodes(cdnId: number): Promise<Episode[]> {
  const url = `${CDN_BASE}/episodes?content-id=${cdnId}`
  const res = await fetch(url, { headers: cdnHeaders() })
  if (!res.ok) throw new Error(`CDN API error: ${res.status}`)
  return res.json() as Promise<Episode[]>
}

export async function resolveCdnId(imdbId: string): Promise<number> {
  const plParam = CDN_PL ? `&pl=${CDN_PL}` : ""
  const url = `${CDN_IFRAME}?imdb=${imdbId}&token=${CDN_TOKEN}&disabled_share=1${plParam}`
  const res = await fetch(url, { redirect: "manual" })
  const html = await res.text()

  const patterns = ["window.MOVIE_ID=", "data-movie-id=\"", "data-id=\""]
  for (const pattern of patterns) {
    const idx = html.indexOf(pattern)
    if (idx === -1) continue
    const after = html.slice(idx + pattern.length)
    const endIdx = after.indexOf(";")
    const endQuote = after.indexOf("\"")
    const end = endIdx !== -1 && (endQuote === -1 || endIdx < endQuote) ? endIdx : endQuote
    const id = parseInt(after.slice(0, end !== -1 ? end : undefined).trim(), 10)
    if (!isNaN(id)) return id
  }

  throw new Error(`CDN id not found in iframe HTML (imdb=${imdbId})`)
}

function proxyUrl(filepath: string): string {
  if (filepath.endsWith(".m3u8")) {
    return `/api/v1/player/hls/proxy?url=${encodeURIComponent(filepath)}`
  }
  return filepath
}

export async function getPlayerData(cdnId: number, season?: number, episode?: number): Promise<CdnVideoDto> {
  const info = await getContentInfo(cdnId)
  const id = `cp_${cdnId}`

  const episodesRaw = await getEpisodes(cdnId).catch(() => [] as Episode[])

  if (episodesRaw.length === 0) {
    const filepath = info.trailerUrls?.[0]
    if (!filepath) throw new Error("no video")
    return { id, title: info.title, isSeries: false, m3u8Url: proxyUrl(filepath), season: null, episode: null, episodes: [] }
  }

  const isSeries = info.hasMultipleEpisodes
  const targetSeason = season ?? 1
  const targetEpisode = episode ?? 1

  const initialEp = isSeries
    ? episodesRaw.find(e => e.season.order === targetSeason && e.order === targetEpisode) ?? episodesRaw[0]
    : episodesRaw[0]

  if (!initialEp) throw new Error("no episodes")

  const initialVariant = initialEp.episodeVariants[0]
  if (!initialVariant) throw new Error("no variants")

  const initialUrl = proxyUrl(initialVariant.filepath)
  const actualSeason = initialEp.season.order
  const actualEpisode = initialEp.order

  const episodes: CdnEpisodeDto[] = []
  for (const e of episodesRaw) {
    const variant = e.episodeVariants[0]
    if (!variant) continue
    episodes.push({
      season: e.season.order,
      episode: e.order,
      title: variant.title || "",
      m3u8Url: proxyUrl(variant.filepath),
    })
  }

  const outSeason = isSeries && actualSeason > 0 && actualEpisode > 0 ? actualSeason : null
  const outEpisode = isSeries && actualSeason > 0 && actualEpisode > 0 ? actualEpisode : null

  return { id, title: info.title, isSeries, m3u8Url: initialUrl, season: outSeason, episode: outEpisode, episodes }
}
