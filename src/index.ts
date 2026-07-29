import { app } from "./app"
import { syncIMDBRatings } from "./services/imdb-ratings"

const port = parseInt(process.env.PORT || "3000")
console.log(`NeoWatch API running on http://localhost:${port}`)
console.log(`API playground at http://localhost:${port}/playground`)

syncIMDBRatings()
  .then(r => console.log(`IMDB ratings synced on startup: ${r.upserted} upserted, ${r.skipped} skipped`))
  .catch(e => console.error("IMDB ratings sync on startup failed:", e))

Bun.serve({
  port,
  fetch: app.fetch,
})
