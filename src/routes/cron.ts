import { Elysia } from "elysia"
import { config } from "../config"
import { success } from "../lib/response"
import { UnauthorizedError } from "../lib/errors"
import { syncIMDBRatings } from "../services/imdb-ratings"

export const cronRoutes = new Elysia()

  .get("/api/v1/cron/imdb-ratings", async ({ request }) => {
    const auth = request.headers.get("authorization")
    if (auth !== `Bearer ${config.cronSecret}`) {
      throw new UnauthorizedError()
    }

    const result = await syncIMDBRatings()
    return success(result)
  })
