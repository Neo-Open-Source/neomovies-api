import { Elysia } from "elysia"
import { allohaRoutes } from "./players/alloha"
import { collapsRoutes } from "./players/collaps"
import { cdnRoutes } from "./players/cdn"
import { hlsRoutes } from "./players/hls"

export const playerRoutes = new Elysia()
  .use(allohaRoutes)
  .use(collapsRoutes)
  .use(cdnRoutes)
  .use(hlsRoutes)
