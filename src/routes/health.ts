import { Elysia } from "elysia"
import { success } from "../lib/response"

export const healthRoutes = new Elysia()

  .get("/api/v1/health", () => {
    return success({
      status: "ok",
      version: "3.0.0",
      timestamp: new Date().toISOString(),
    })
  }, {
    detail: { tags: ["Health"], summary: "Health Check" },
  })
