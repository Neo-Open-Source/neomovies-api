import { db } from "../../db"
import { tmdb } from "../tmdb"
import { resolveIds } from "../alloha"
import type { Language } from "../../lib/language"
import { mapCastMember, mapCrewMember, mapSeason, mapCompany, mapNetwork } from "../../lib/mappers"

export interface TmdbCreditsResponse {
  cast: Array<{
    id: number; name: string; character: string;
    profile_path: string | null; order: number
  }>
  crew: Array<{
    id: number; name: string; job: string;
    department: string; profile_path: string | null
  }>
}

export async function fetchImdbRating(imdbId: string | null) {
  if (!imdbId) return { imdbRating: null, imdbVotes: null }
  const rows = await db.$queryRawUnsafe<Array<{ imdbRating: number | null; imdbVotes: number | null }>>(
    "SELECT \"imdbRating\", \"imdbVotes\" FROM \"MediaRating\" WHERE \"imdbId\" = $1", imdbId,
  )
  const rating = rows?.[0] ?? null
  return {
    imdbRating: rating ? Number(rating.imdbRating) : null,
    imdbVotes: rating?.imdbVotes ?? null,
  }
}

export async function resolveExternalIds(
  tmdbId: number, mediaType: "movie" | "tv", tmdbImdbId: string | null,
): Promise<{ imdbId: string | null; kpId: number | null; imdbRating: number | null; imdbVotes: number | null }> {
  const ids = await resolveIds(tmdbId, mediaType)
  const imdbId = tmdbImdbId || ids.imdbId
  if (!imdbId) return { imdbId: null, kpId: ids.kpId, imdbRating: null, imdbVotes: null }
  const rating = await fetchImdbRating(imdbId)
  return { imdbId, kpId: ids.kpId, ...rating }
}

export function extractTrailers(videos: { results: Array<{ key: string; site: string; type: string; name: string; official: boolean }> }): string[] {
  return (videos.results || [])
    .filter(v => v.site === "YouTube" && v.type === "Trailer")
    .map(v => v.key)
}

export function formatCredits(c: TmdbCreditsResponse) {
  return {
    cast: (c.cast || []).slice(0, 20).map(mapCastMember),
    crew: (c.crew || []).slice(0, 20).map(mapCrewMember),
  }
}

const genreCache = new Map<string, Map<number, string>>()

export async function genreNames(type: "movie" | "tv", lang: Language): Promise<Map<number, string>> {
  const key = `${type}:${lang}`
  let cached = genreCache.get(key)
  if (!cached) {
    const data = type === "movie" ? await tmdb.movieGenres(lang) : await tmdb.tvGenres(lang)
    cached = new Map(data.genres.map(g => [g.id, g.name]))
    genreCache.set(key, cached)
  }
  return cached
}

export function enrichGenreNames(
  items: Array<{ tmdbId: number; genres: { id: number; name: string }[] | null }>,
  names: Map<number, string>,
  rawResults: Array<{ id: number; genre_ids?: number[] }>,
) {
  const rawMap = new Map(rawResults.filter(r => r.genre_ids?.length).map(r => [r.id, r.genre_ids!]))
  for (const item of items) {
    if (!item.genres) {
      const ids = rawMap.get(item.tmdbId)
      if (ids?.length) {
        item.genres = ids.map(id => ({ id, name: names.get(id) ?? String(id) }))
      }
    }
  }
}

export async function enrichCertifications(items: Array<{ tmdbId: number; certification: string | null }>, type: "movie" | "tv") {
  const certs = await Promise.all(
    items.map(i => type === "movie" ? tmdb.movieCertification(i.tmdbId) : tmdb.tvCertification(i.tmdbId)),
  )
  items.forEach((i, idx) => { i.certification = certs[idx] })
}

export function movieDetailFromTMDB(movie: any) {
  return {
    imdbId: movie.imdb_id,
    runtime: movie.runtime,
    budget: movie.budget,
    revenue: movie.revenue,
    status: movie.status,
    tagline: movie.tagline,
    productionCompanies: (movie.production_companies || []).map(mapCompany),
    collection: movie.belongs_to_collection
      ? {
          id: movie.belongs_to_collection.id,
          name: movie.belongs_to_collection.name,
          poster: tmdb.imageUrl(movie.belongs_to_collection.poster_path, "w300"),
        }
      : null,
  }
}

export function tvDetailFromTMDB(show: any) {
  return {
    seasons: (show.seasons || []).map(mapSeason),
    numberOfSeasons: show.number_of_seasons,
    numberOfEpisodes: show.number_of_episodes,
    status: show.status,
    tagline: show.tagline,
    networks: (show.networks || []).map(mapNetwork),
    productionCompanies: (show.production_companies || []).map(mapCompany),
  }
}
