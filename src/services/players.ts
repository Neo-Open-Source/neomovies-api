import { config } from "../config"

interface AllohaResponse {
  status: string
  data?: {
    iframe?: string
    id_kp?: number
    id_imdb?: string
    id_tmdb?: number
    seasons?: Record<string, {
      iframe?: string
      episodes?: Record<string, {
        iframe?: string
        translation?: Record<string, { iframe?: string }>
      }>
    }>
  }
}

interface CollapsListResponse {
  results?: CollapsResult[]
}

interface CollapsResult {
  type?: string
  iframe_url?: string
  seasons?: CollapsSeason[]
}

interface CollapsSeason {
  season?: number
  episodes?: CollapsEpisode[]
}

interface CollapsEpisode {
  episode?: number | string
  iframe_url?: string
}

function iframeHtml(url: string, title: string): string {
  return `<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'/><title>${title}</title><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}iframe{display:block;position:fixed;inset:0;width:100vw;height:100vh;border:0;background:#000;}</style></head><body><iframe src="${url}" allowfullscreen loading="eager" scrolling="no" referrerpolicy="no-referrer-when-downgrade" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe></body></html>`
}

function wrapExistingHtml(html: string, title: string): string {
  const cleaned = html.replace(/\\"/g, '"').replace(/\\'/g, "'")
  return `<!DOCTYPE html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1,viewport-fit=cover'/><title>${title}</title><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;}</style></head><body>${cleaned}</body></html>`
}

// ── Alloha ──────────────────────────────────────────────────────────────────

function nonEmptyStr(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v
  return null
}

function firstTranslationIframe(translationObj: Record<string, { iframe?: string }> | undefined): string | null {
  if (!translationObj) return null
  for (const tr of Object.values(translationObj)) {
    const url = nonEmptyStr(tr?.iframe)
    if (url) return url
  }
  return null
}

function firstEpisodeIframe(episode: { iframe?: string; translation?: Record<string, { iframe?: string }> } | undefined): string | null {
  if (!episode) return null
  return nonEmptyStr(episode.iframe) ?? firstTranslationIframe(episode.translation)
}

function pickAllohaIframe(data: AllohaResponse["data"], season?: number, episode?: number): string | null {
  if (!data) return null

  const topIframe = nonEmptyStr(data.iframe)
  if (topIframe) return topIframe

  const seasons = data.seasons
  if (!seasons) return null

  if (season != null) {
    const seasonKey = String(season)
    const seasonObj = seasons[seasonKey]
    if (!seasonObj) return null

    if (episode != null) {
      const episodeKey = String(episode)
      const episodes = seasonObj.episodes
      if (episodes) {
        const ep = episodes[episodeKey]
        const url = firstEpisodeIframe(ep)
        if (url) return url
      }
      return nonEmptyStr(seasonObj.iframe)
    }

    const seasonIframe = nonEmptyStr(seasonObj.iframe)
    if (seasonIframe) return seasonIframe

    const episodes = seasonObj.episodes
    if (episodes) {
      for (const ep of Object.values(episodes)) {
        const url = firstEpisodeIframe(ep)
        if (url) return url
      }
    }
    return null
  }

  for (const seasonObj of Object.values(seasons)) {
    const url = nonEmptyStr(seasonObj.iframe)
    if (url) return url

    const episodes = seasonObj.episodes
    if (episodes) {
      for (const ep of Object.values(episodes)) {
        const url = firstEpisodeIframe(ep)
        if (url) return url
      }
    }
  }
  return null
}

async function fetchAllohaJson(kpId?: number, tmdbId?: number, imdbId?: string): Promise<AllohaResponse> {
  if (!config.alloha.token) throw new Error("not_configured")

  let param: string
  if (kpId) param = `kp=${kpId}`
  else if (tmdbId) param = `tmdb=${tmdbId}`
  else if (imdbId) param = `imdb=${imdbId}`
  else throw new Error("missing_id")

  const urls = [
    `https://api.alloha.tv/?token=${config.alloha.token}&${param}`,
    `http://api.alloha.tv/?token=${config.alloha.token}&${param}`,
  ]

  let lastErr: string | undefined
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "NeoWatch/3.0 (+https://neome.uk)" },
      })
      if (res.ok) {
        return await res.json() as AllohaResponse
      }
      lastErr = `HTTP ${res.status}`
    } catch (e) {
      lastErr = (e as Error).message
    }
  }
  throw new Error(`alloha request failed: ${lastErr ?? "unknown"}`)
}

export async function getAllohaPlayer(
  kpId?: number,
  tmdbId?: number,
  imdbId?: string,
  season?: number,
  episode?: number,
): Promise<string> {
  const payload = await fetchAllohaJson(kpId, tmdbId, imdbId)
  if (payload.status !== "success") throw new Error("not_found")

  const iframeCode = pickAllohaIframe(payload.data, season, episode)
  if (!iframeCode) throw new Error("not_found")

  if (!iframeCode.includes("<")) {
    return iframeHtml(iframeCode, "Alloha Player")
  }
  return wrapExistingHtml(iframeCode, "Alloha Player")
}

export async function getAllohaPlayerUrl(
  kpId?: number,
  tmdbId?: number,
  imdbId?: string,
  season?: number,
  episode?: number,
): Promise<{ url: string; type: string }> {
  const params = new URLSearchParams()
  if (kpId) params.set("kp", String(kpId))
  if (tmdbId) params.set("tmdb", String(tmdbId))
  if (imdbId) params.set("imdb", imdbId)
  if (season) params.set("season", String(season))
  if (episode) params.set("episode", String(episode))

  return { url: `/api/v1/player/alloha/proxy?${params.toString()}`, type: "iframe" }
}

// ── Collaps ─────────────────────────────────────────────────────────────────

function collapsEpisodeNum(ep: CollapsEpisode): number {
  if (typeof ep.episode === "number") return ep.episode
  if (typeof ep.episode === "string") return parseInt(ep.episode, 10) || 0
  return 0
}

async function fetchCollapsList(kpId?: number, imdbId?: string): Promise<CollapsListResponse> {
  if (!config.collaps.host || !config.collaps.token) throw new Error("not_configured")

  const base = config.collaps.host.replace(/\/$/, "")
  let url: string
  if (kpId) {
    url = `${base}/list?token=${config.collaps.token}&kinopoisk_id=${kpId}`
  } else if (imdbId) {
    url = `${base}/list?token=${config.collaps.token}&imdb_id=${imdbId}`
  } else {
    throw new Error("missing_id")
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error("not_found")
  return await res.json() as CollapsListResponse
}

function pickCollapsIframe(data: CollapsListResponse, season?: number, episode?: number): string | null {
  const result = data.results?.[0]
  if (!result) return null

  if (result.type === "series") {
    const seasons = result.seasons ?? []
    if (season != null && episode != null) {
      const s = seasons.find(s => s.season === season)
      return s?.episodes?.find(e => collapsEpisodeNum(e) === episode)?.iframe_url ?? null
    }
    if (season != null) {
      const s = seasons.find(s => s.season === season)
      return s?.episodes?.[0]?.iframe_url ?? null
    }
    return result.iframe_url ?? seasons[0]?.episodes?.[0]?.iframe_url ?? null
  }

  return result.iframe_url ?? null
}

export async function getCollapsPlayer(
  kpId?: number,
  imdbId?: string,
  season?: number,
  episode?: number,
): Promise<string> {
  const data = await fetchCollapsList(kpId, imdbId)
  const iframeUrl = pickCollapsIframe(data, season, episode)
  if (!iframeUrl) throw new Error("not_found")
  return iframeHtml(iframeUrl, "Collaps Player")
}

export async function getCollapsPlayerUrl(
  kpId?: number,
  imdbId?: string,
  season?: number,
  episode?: number,
): Promise<{ url: string; type: string }> {
  const data = await fetchCollapsList(kpId, imdbId)
  const iframeUrl = pickCollapsIframe(data, season, episode)
  if (!iframeUrl) throw new Error("not_found")
  return { url: iframeUrl, type: "iframe" }
}
