import { Elysia, t } from "elysia"
import { tmdb } from "../services/tmdb"
import { success } from "../lib/response"
import { NotFoundError, BadRequestError } from "../lib/errors"
import { BACKDROP_SIZES, type BackdropSize } from "../lib/images"
import { language } from "../lib/language"
import { config } from "../config"
import type { TMDBImagesResponse, TMDBImageItem } from "../types/tmdb"

// Edge-cacheable on Vercel (s-maxage) and browser-cacheable (max-age): images
// are immutable per TMDB path, so a 7-day CDN cache removes the serverless
// cold-start + TMDB refetch from every image load.
const IMAGE_CACHE = "public, max-age=604800, s-maxage=604800, immutable"

async function fetchImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new BadRequestError("Image not found")
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get("content-type") || "image/jpeg",
  }
}

function imageResponse(buffer: Buffer, contentType: string): Response {
  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": IMAGE_CACHE,
      "Access-Control-Allow-Origin": "*",
    },
  })
}

const TMDB_SIZES = ["w92", "w154", "w185", "w300", "w342", "w500", "w780", "w1280", "h632", "original"] as const

function resolveSize(size: string | undefined, fallback: string): string {
  if (!size) return fallback
  return TMDB_SIZES.includes(size as any) ? size : fallback
}

async function detectType(id: number): Promise<{ type: "movie" | "tv"; found: boolean }> {
  try {
    await tmdb.movie(id, "en-US")
    return { type: "movie", found: true }
  } catch {
    try {
      await tmdb.tvShow(id, "en-US")
      return { type: "tv", found: true }
    } catch {
      return { type: "movie", found: false }
    }
  }
}

function pickBest(items: TMDBImageItem[]): string | null {
  if (!items.length) return null
  const scored = items
    .filter(i => i.file_path)
    .map(i => ({ path: i.file_path, score: (i.vote_count || 0) * 10 + (i.vote_average || 0) }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.path ?? null
}

function pickByLang(items: TMDBImageItem[], lang: string): string | null {
  const langPrefix = lang.slice(0, 2)
  const byLang = items.filter(i => i.iso_639_1 === langPrefix)
  if (byLang.length) return pickBest(byLang)
  const en = items.filter(i => i.iso_639_1 === "en")
  if (en.length) return pickBest(en)
  const any = items.filter(i => i.iso_639_1 !== null)
  if (any.length) return pickBest(any)
  return null
}

async function fetchImages(id: number, mediaType: "movie" | "tv", extra: Record<string, string> = {}): Promise<TMDBImagesResponse> {
  return tmdb.get<TMDBImagesResponse>(
    `/${mediaType}/${id}/images`,
    extra
  )
}

async function fetchNullImages(id: number, mediaType: "movie" | "tv"): Promise<TMDBImagesResponse> {
  return tmdb.get<TMDBImagesResponse>(
    `/${mediaType}/${id}/images`,
    { include_image_language: "null" }
  )
}

const IMAGE_PROXY_PREFIXES = ["/image/", "/api/v1/image/"] as const

function proxyImagePath(pathname: string): string | null {
  for (const prefix of IMAGE_PROXY_PREFIXES) {
    if (pathname.startsWith(prefix)) return pathname.slice(prefix.length)
  }
  return null
}

async function serveProxyImage(pathname: string): Promise<Response> {
  const rest = proxyImagePath(pathname)
  if (!rest) throw new BadRequestError("Missing image path")

  const firstSlash = rest.indexOf("/")
  if (firstSlash === -1) throw new BadRequestError("Invalid image path")

  const size = rest.substring(0, firstSlash)
  const path = rest.substring(firstSlash)
  const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${path}`)
  return imageResponse(buffer, contentType)
}

export const imageRoutes = new Elysia()

  .get("/image/*", async ({ request }) => serveProxyImage(new URL(request.url).pathname))
  .get("/api/v1/image/*", async ({ request }) => serveProxyImage(new URL(request.url).pathname))

  .get("/api/v1/images/poster/:id", async ({ params: { id }, query }) => {
    const lang = language(query)
    const size = resolveSize(query.size, "w500")
    const explicitType = query.type as "movie" | "tv" | undefined
    const detected = explicitType ? { type: explicitType, found: true } : await detectType(id)
    if (!detected.found) throw new NotFoundError("Content not found")

    const details = detected.type === "movie"
      ? await tmdb.movie(id, lang)
      : await tmdb.tvShow(id, lang)
    if (!details.poster_path) throw new NotFoundError("No poster")

    const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${details.poster_path}`)
    return imageResponse(buffer, contentType)
  }, {
    detail: { tags: ["Images"], summary: "Poster by TMDB ID" },
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({ language: t.Optional(t.String()), type: t.Optional(t.String()), size: t.Optional(t.String()) }),
  })

  .get("/api/v1/images/backdrop/:id", async ({ params: { id }, query }) => {
    const lang = language(query)
    const size = resolveSize(query.size, "w1280")
    const explicitType = query.type as "movie" | "tv" | undefined
    const detected = explicitType ? { type: explicitType, found: true } : await detectType(id)
    if (!detected.found) throw new NotFoundError("Content not found")

    const allImages = await fetchNullImages(id, detected.type)
    let imagePath = pickBest(allImages.backdrops)
    if (!imagePath) {
      const details = detected.type === "movie" ? await tmdb.movie(id, lang) : await tmdb.tvShow(id, lang)
      imagePath = details.backdrop_path || details.poster_path
    }
    if (!imagePath) throw new NotFoundError("No image")

    const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${imagePath}`)
    return imageResponse(buffer, contentType)
  }, {
    detail: { tags: ["Images"], summary: "Backdrop (no text)" },
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({ language: t.Optional(t.String()), type: t.Optional(t.String()), size: t.Optional(t.String()) }),
  })

  .get("/api/v1/images/backdrop/:id/text", async ({ params: { id }, query }) => {
    const lang = language(query)
    const size = resolveSize(query.size, "w1280")
    const explicitType = query.type as "movie" | "tv" | undefined
    const detected = explicitType ? { type: explicitType, found: true } : await detectType(id)
    if (!detected.found) throw new NotFoundError("Content not found")

    // Ask TMDB for title-card backdrops in the requested language (plus EN and
    // language-less ones). Passing include_image_language replaces the default
    // (en+null), so the target language must be listed explicitly for a
    // localized "backdrop with text" preview.
    const langPrefix = lang.slice(0, 2)
    const allImages = await fetchImages(id, detected.type, {
      include_image_language: `${langPrefix},en,null`,
    })
    const backdrop = pickByLang(allImages.backdrops, lang)
    const details = detected.type === "movie" ? await tmdb.movie(id, lang) : await tmdb.tvShow(id, lang)
    const imagePath = backdrop || details.backdrop_path || details.poster_path
    if (!imagePath) throw new NotFoundError("No image")

    const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${imagePath}`)
    return imageResponse(buffer, contentType)
  }, {
    detail: { tags: ["Images"], summary: "Backdrop with Text" },
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({ language: t.Optional(t.String()), type: t.Optional(t.String()), size: t.Optional(t.String()) }),
  })

  .get("/api/v1/images/logo/:id", async ({ params: { id }, query }) => {
    const lang = language(query)
    const size = resolveSize(query.size, "w500")
    const explicitType = query.type as "movie" | "tv" | undefined
    const detected = explicitType ? { type: explicitType, found: true } : await detectType(id)
    if (!detected.found) throw new NotFoundError("Content not found")

    const allImages = await fetchImages(id, detected.type)
    const logo = pickByLang(allImages.logos, lang)
    if (!logo) throw new NotFoundError("No logo")

    const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${logo}`)
    return imageResponse(buffer, contentType)
  }, {
    detail: { tags: ["Images"], summary: "Logo by TMDB ID" },
    params: t.Object({ id: t.Numeric() }),
    query: t.Object({ language: t.Optional(t.String()), type: t.Optional(t.String()), size: t.Optional(t.String()) }),
  })

  .get("/api/v1/images/screens/:id/:season/:episode", async ({ params: { id, season, episode }, query }) => {
    const lang = language(query)
    const size = resolveSize(query.size, "w300")
    const ep = await tmdb.tvEpisode(id, season, episode, lang)
    if (!ep.still_path) throw new NotFoundError("No still")

    const { buffer, contentType } = await fetchImage(`${config.tmdb.imageBaseUrl}/${size}${ep.still_path}`)
    return imageResponse(buffer, contentType)
  }, {
    detail: { tags: ["Images"], summary: "Episode Still by TMDB ID" },
    params: t.Object({ id: t.Numeric(), season: t.Numeric(), episode: t.Numeric() }),
    query: t.Object({ language: t.Optional(t.String()), size: t.Optional(t.String()) }),
  })

  .get("/api/v1/images/:type/:id/backdrops", async ({ params: { type, id }, query }) => {
    const lang = language(query)
    const size = query.size as BackdropSize | undefined

    if (type === "movie") {
      const movie = await tmdb.movie(id, lang)
      if (!movie.backdrop_path) throw new NotFoundError("No backdrops")
      if (size && BACKDROP_SIZES.includes(size)) {
        return success({ backdrop: tmdb.imageUrl(movie.backdrop_path, size) })
      }
      return success({ backdrops: tmdb.imageSizes(movie.backdrop_path, BACKDROP_SIZES) })
    }

    const [show, externalIds] = await Promise.all([
      tmdb.tvShow(id, lang),
      tmdb.tvExternalIds(id).catch(() => null),
    ])
    if (!show.backdrop_path) throw new NotFoundError("No backdrops")

    if (size && BACKDROP_SIZES.includes(size)) {
      return success({ backdrop: tmdb.imageUrl(show.backdrop_path, size) })
    }

    return success({
      backdrops: tmdb.imageSizes(show.backdrop_path, BACKDROP_SIZES),
      imdbId: externalIds?.imdb_id ?? null,
    })
  }, {
    detail: { tags: ["Images"], summary: "Backdrops by Type" },
    params: t.Object({ type: t.Enum({ movie: "movie", tv: "tv" }), id: t.Numeric() }),
    query: t.Object({ size: t.Optional(t.String()), language: t.Optional(t.String()) }),
  })


