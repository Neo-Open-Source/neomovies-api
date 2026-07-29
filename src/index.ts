import { app } from "./app"
import { syncIMDBRatings } from "./services/imdb-ratings"

const port = parseInt(process.env.PORT || "3000")
console.log(`NeoWatch API running on http://localhost:${port}`)
console.log(`API playground at http://localhost:${port}/playground`)

syncIMDBRatings()
  .then(r => console.log(`IMDB sync done: ${r.upserted.toLocaleString()} upserted, ${r.skipped.toLocaleString()} skipped`))
  .catch(e => console.error("IMDB sync failed:", e.message))

Bun.serve({
  port,
  fetch: app.fetch,
})
