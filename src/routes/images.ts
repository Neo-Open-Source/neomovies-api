import { Elysia } from "elysia"
import { badRequest } from "../lib/response"
import { config } from "../config"

export const imageRoutes = new Elysia()

  .get("/image/*", async ({ request }) => {
    const url = new URL(request.url)
    const imagePath = url.pathname.replace("/image/", "")

    if (!imagePath) return badRequest("Missing image path")

    const tmdbUrl = `${config.tmdb.imageBaseUrl}/original/${imagePath}`

    const res = await fetch(tmdbUrl)
    if (!res.ok) return badRequest("Image not found")

    const contentType = res.headers.get("content-type") || "image/jpeg"
    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  })
