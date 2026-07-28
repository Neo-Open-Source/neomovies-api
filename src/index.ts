import { app } from "./app"

const port = parseInt(process.env.PORT || "3000")
console.log(`NeoWatch API running on http://localhost:${port}`)
console.log(`API playground at http://localhost:${port}/playground`)

Bun.serve({
  port,
  fetch: app.fetch,
})
