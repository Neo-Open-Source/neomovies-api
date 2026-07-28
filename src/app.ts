import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { assertConfig } from "./config"
import { AppError } from "./lib/errors"
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
import { categoryRoutes } from "./routes/categories"
import { cronRoutes } from "./routes/cron"

assertConfig()

export const app = new Elysia()
  .onError(({ code, error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode
      return { success: false, error: error.message }
    }
    if (code === "NOT_FOUND") {
      set.status = 404
      return { success: false, error: "Not Found" }
    }
    if (code === "VALIDATION") {
      set.status = 400
      return { success: false, error: error.message }
    }
    if (code === "PARSE") {
      set.status = 400
      return { success: false, error: "Invalid request body" }
    }
    if (code === "INTERNAL_SERVER_ERROR" || code === "UNKNOWN") {
      console.error("Unhandled error:", error)
      set.status = 500
      return { success: false, error: "Internal server error" }
    }
  })
  .use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }))
  .use(swagger({
    path: "/playground",
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
  .use(categoryRoutes)
  .use(cronRoutes)
