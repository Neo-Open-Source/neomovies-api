import { Elysia } from "elysia"
import { config } from "../config"
import { success } from "../lib/response"
import { UnauthorizedError } from "../lib/errors"
import { syncIMDBRatings } from "../services/imdb-ratings"

export const cronRoutes = new Elysia()

  .get("/api/v1/cron/imdb-ratings", async ({ request }) => {
    const auth = request.headers.get("authorization")
    const isVercelCron = ["true", "1"].includes(request.headers.get("x-vercel-cron") || "")
    if (!isVercelCron && auth !== `Bearer ${config.cronSecret}`) {
      throw new UnauthorizedError()
    }

    const result = await syncIMDBRatings(true)
    return success(result)
  }, {
    detail: { hide: true },
  })
