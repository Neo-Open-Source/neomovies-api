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

function progressBar(current: number, total: number, label: string): string {
  const width = 30
  const pct = total > 0 ? Math.min(current / total, 1) : 0
  const filled = Math.round(pct * width)
  const bar = "█".repeat(filled) + "░".repeat(width - filled)
  const pctStr = (pct * 100).toFixed(total > 10_000_000 ? 0 : 1).padStart(4) + "%"
  return `${label} ${bar} ${pctStr}`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return (bytes / 1_000_000_000).toFixed(1) + "GB"
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + "MB"
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + "KB"
  return bytes + "B"
}

export async function syncIMDBRatings(): Promise<{ upserted: number; skipped: number }> {
  const rows = await db.$queryRawUnsafe<Array<{ updatedAt: Date }>>("SELECT \"updatedAt\" FROM \"MediaRating\" ORDER BY \"updatedAt\" DESC LIMIT 1")
  const recent = rows?.[0]
  if (recent && Date.now() - recent.updatedAt.getTime() < 24 * 60 * 60 * 1000) {
    console.log(`IMDB ratings last synced at ${recent.updatedAt.toISOString()}, skipping (ok in 24h)`)
    return { upserted: 0, skipped: 0 }
  }

  const res = await fetch(RATINGS_URL)
  if (!res.ok) throw new Error(`IMDB dataset fetch failed: ${res.status}`)

  const totalBytes = parseInt(res.headers.get("content-length") || "0", 10)
  const reader = res.body?.getReader()
  if (!reader) throw new Error("No response body")

  const chunks: Uint8Array[] = []
  let downloaded = 0
  process.stdout.write(progressBar(0, totalBytes, "Downloading") + "\r")

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length
    process.stdout.write(progressBar(downloaded, totalBytes, "Downloading") + "\r")
  }
  process.stdout.write(progressBar(downloaded, totalBytes, "Downloaded ") + "\n")

  process.stdout.write("Decompressing...\r")
  const compressed = new Uint8Array(downloaded)
  let offset = 0
  for (const chunk of chunks) {
    compressed.set(chunk, offset)
    offset += chunk.length
  }
  const decompressed = Bun.gunzipSync(compressed)
  const text = new TextDecoder().decode(decompressed)
  process.stdout.write("Decompressed: " + formatBytes(text.length * 2) + "\n")

  const lines = text.split("\n")
  const totalLines = lines.length
  process.stdout.write(progressBar(0, totalLines, "Processing") + "\r")

  let upserted = 0
  let skipped = 0
  let batch: { imdbId: string; imdbRating: number; imdbVotes: number }[] = []

  for (let i = 1; i < totalLines; i++) {
    const parsed = parseTSVLine(lines[i])
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
      process.stdout.write(progressBar(i, totalLines, "Processing") + "\r")
    }
  }

  if (batch.length > 0) {
    await upsertBatch(batch)
    upserted += batch.length
  }

  process.stdout.write(progressBar(totalLines, totalLines, "Processed ") + "\n")
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
