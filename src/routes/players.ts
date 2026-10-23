import { Elysia, t } from "elysia"
import { success } from "../lib/response"
import { getPlayerAvailability } from "../services/availability"
import { allohaRoutes } from "./players/alloha"
import { collapsRoutes } from "./players/collaps"
import { cdnRoutes } from "./players/cdn"
import { kodikRoutes } from "./players/kodik"

export const playerRoutes = new Elysia()
  .get("/api/v1/player/availability", async ({ query }) => {
    return success(await getPlayerAvailability({
      kpId: query.kp,
      tmdbId: query.tmdb,
      imdbId: query.imdb,
    }))
  }, {
    detail: { tags: ["Players"], summary: "Player Availability" },
    query: t.Object({
      kp: t.Optional(t.Numeric()),
      tmdb: t.Optional(t.Numeric()),
      imdb: t.Optional(t.String()),
    }),
  })
  .use(allohaRoutes)
  .use(collapsRoutes)
  .use(cdnRoutes)
  .use(kodikRoutes)
