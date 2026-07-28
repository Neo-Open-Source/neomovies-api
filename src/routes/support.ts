import { Elysia } from "elysia"
import { success } from "../lib/response"

const supporters = [
  "Єрнела",
]

export const supportRoutes = new Elysia()
  .get("/api/v1/support/list", () => success(supporters))
