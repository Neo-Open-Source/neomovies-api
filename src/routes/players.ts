import { Elysia } from "elysia"
import { allohaRoutes } from "./players/alloha"
import { collapsRoutes } from "./players/collaps"
import { cdnRoutes } from "./players/cdn"

export const playerRoutes = new Elysia()
  .use(allohaRoutes)
  .use(collapsRoutes)
  .use(cdnRoutes)
