import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { assertConfig } from "./config"
import { AppError } from "./lib/errors"
import { authRoutes } from "./routes/auth"
import { mediaRoutes } from "./routes/media"
import { searchRoutes } from "./routes/search"
import { genreRoutes } from "./routes/genres"
import { personRoutes } from "./routes/person"

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

/**
 * Public GET endpoints that Vercel's edge can cache.
 * Vary by full URL (query string included), so language variants are cached
 * separately. User-scoped / stateful routes are excluded (auth, favorites,
 * watch-later, sync, players, torrents, cron, webhooks).
 */
const EDGE_CACHE = "public, s-maxage=300, stale-while-revalidate=600"

const NO_EDGE_CACHE_PREFIXES = [
  "/api/v1/favorites",
  "/api/v1/watch-later",
  "/api/v1/sync",
  "/api/v1/auth",
  "/api/v1/players",
  "/api/v1/torrents",
  "/api/v1/cron",
  "/api/v1/webhooks",
]

function isEdgeCacheable(request: Request): boolean {
  if (request.method !== "GET") return false
  const url = new URL(request.url)
  const path = url.pathname
  return !NO_EDGE_CACHE_PREFIXES.some((p) => path.startsWith(p))
}

export const app = new Elysia()
  .onAfterHandle(({ set, request }) => {
    if (!isEdgeCacheable(request)) return
    // Image routes already send their own long-lived immutable cache headers.
    const path = new URL(request.url).pathname
    if (path.startsWith("/image/") || path.startsWith("/api/v1/image/") || path.startsWith("/api/v1/images/")) return
    set.headers["Cache-Control"] = EDGE_CACHE
  })
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
    exclude: ["/api/v1/cron/imdb-ratings"],
    documentation: {
      info: {
        title: "NeoWatch API",
        version: "1.0.0",
        description: "REST API for NeoWatch - movies and TV shows streaming platform",
      },
      tags: [
        { name: "Auth", description: "Authentication and authorization" },
        { name: "Categories", description: "Browse categories and collections" },
        { name: "Favorites", description: "User favorites management" },
        { name: "Genres", description: "Movie and TV genres list" },
        { name: "Health", description: "Health check endpoint" },
        { name: "Images", description: "Image proxy and backdrops" },
        { name: "Media", description: "Movie and TV show details" },
        { name: "Players", description: "Video streaming players" },
        { name: "Search", description: "Multi-type search" },
        { name: "People", description: "Person details and filmography" },
        { name: "Support", description: "Supporters list" },
        { name: "Sync", description: "Cross-device sync progress" },
        { name: "Torrents", description: "Torrent search" },
        { name: "Watch Later", description: "Watch later management" },
        { name: "Webhooks", description: "External webhook handlers" },
      ],
    },
  }))
  .use(healthRoutes)
  .use(authRoutes)
  .use(mediaRoutes)
  .use(searchRoutes)
  .use(genreRoutes)
  .use(personRoutes)
  .use(supportRoutes)
  .use(favoriteRoutes)
  .use(watchLaterRoutes)
  .use(syncRoutes)
  .use(playerRoutes)
  .use(imageRoutes)
  .use(torrentRoutes)
  .use(webhookRoutes)
  .use(categoryRoutes)
  .use(cronRoutes)
