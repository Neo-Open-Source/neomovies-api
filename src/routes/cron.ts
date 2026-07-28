import { Elysia } from "elysia"
import { config } from "../config"
import { syncIMDBRatings } from "../services/imdb-ratings"

export const cronRoutes = new Elysia()

  .get("/api/v1/cron/imdb-ratings", async ({ request }) => {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${config.cronSecret}`) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    try {
      const result = await syncIMDBRatings()
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  })
