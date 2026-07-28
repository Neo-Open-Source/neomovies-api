import { db } from "../db"

const RATINGS_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz"

interface IMDBRow {
  tconst: string
  averageRating: number
  numVotes: number
}

function parseTSVLine(line: string): IMDBRow | null {
  const cols = line.split("\t")
  if (cols.length < 3) return null
  const [tconst, averageRating, numVotes] = cols
  if (!tconst || tconst === "tconst") return null
  const rating = parseFloat(averageRating)
  const votes = parseInt(numVotes, 10)
  if (isNaN(rating) || isNaN(votes)) return null
  return { tconst, averageRating: rating, numVotes: votes }
}

export async function syncIMDBRatings(): Promise<{ upserted: number; skipped: number }> {
  const res = await fetch(RATINGS_URL)
  if (!res.ok) throw new Error(`IMDB dataset fetch failed: ${res.status}`)

  const buf = await res.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buf))
  const text = new TextDecoder().decode(decompressed)
  const lines = text.split("\n")

  let upserted = 0
  let skipped = 0
  let batch: { imdbId: string; imdbRating: number; imdbVotes: number }[] = []

  for (const line of lines) {
    const parsed = parseTSVLine(line)
    if (!parsed) { skipped++; continue }

    batch.push({
      imdbId: parsed.tconst,
      imdbRating: parsed.averageRating,
      imdbVotes: parsed.numVotes,
    })

    if (batch.length >= 1000) {
      await upsertBatch(batch)
      upserted += batch.length
      batch = []
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch)
    upserted += batch.length
  }

  return { upserted, skipped }
}

async function upsertBatch(batch: { imdbId: string; imdbRating: number; imdbVotes: number }[]): Promise<void> {
  const ids = batch.map(r => r.imdbId)
  const ratings = batch.map(r => r.imdbRating)
  const votes = batch.map(r => r.imdbVotes)
  await db.$executeRaw`
    INSERT INTO "MediaRating" ("imdbId", "imdbRating", "imdbVotes", "updatedAt")
    SELECT UNNEST(${ids}::text[]), UNNEST(${ratings}::decimal[]), UNNEST(${votes}::int[]), NOW()
    ON CONFLICT ("imdbId") DO UPDATE SET
      "imdbRating" = EXCLUDED."imdbRating",
      "imdbVotes" = EXCLUDED."imdbVotes",
      "updatedAt" = NOW()
  `
}
