import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { assertConfig } from "./config"
import { authRoutes } from "./routes/auth"
import { mediaRoutes } from "./routes/media"
import { searchRoutes } from "./routes/search"

import { genreRoutes } from "./routes/genres"
import { favoriteRoutes } from "./routes/favorites"
import { watchLaterRoutes } from "./routes/watch-later"
import { syncRoutes } from "./routes/sync"
import { playerRoutes } from "./routes/players"
import { imageRoutes } from "./routes/images"
import { supportRoutes } from "./routes/support"
import { torrentRoutes } from "./routes/torrents"
import { webhookRoutes } from "./routes/webhooks"
import { healthRoutes } from "./routes/health"
import { cronRoutes } from "./routes/cron"

assertConfig()

export const app = new Elysia()
  .use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }))
  .use(swagger({
    path: "/api/docs",
    documentation: {
      info: {
        title: "NeoWatch API",
        version: "3.0.0",
        description: "REST API for NeoWatch - movies and TV shows streaming platform",
      },
    },
  }))
  .use(healthRoutes)
  .use(authRoutes)
  .use(mediaRoutes)
  .use(searchRoutes)
  .use(supportRoutes)
  .use(genreRoutes)
  .use(favoriteRoutes)
  .use(watchLaterRoutes)
  .use(syncRoutes)
  .use(playerRoutes)
  .use(imageRoutes)
  .use(torrentRoutes)
  .use(webhookRoutes)
  .use(cronRoutes)
  .get("/", () => Response.redirect("/api/docs"))
  .all("*", () => {
    return new Response(JSON.stringify({ success: false, error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  })
