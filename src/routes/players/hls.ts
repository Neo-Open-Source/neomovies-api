import { Elysia, t } from "elysia"
import { BadRequestError } from "../../lib/errors"

export const hlsRoutes = new Elysia()

  .get("/api/v1/player/hls/proxy", async ({ query, request }) => {
    const url = query.url
    if (!url) throw new BadRequestError("Missing url parameter")

    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })
    if (!res.ok) throw new BadRequestError("Failed to fetch HLS stream")

    const contentType = res.headers.get("content-type") || ""
    const text = await res.text()

    if (!contentType.includes("mpegurl") && !text.startsWith("#EXTM3U")) {
      return new Response(await res.arrayBuffer(), {
        headers: { "Content-Type": contentType || "video/MP2T", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=604800" },
      })
    }

    const baseUrl = new URL(url)
    const proxyBase = `${request.url.split("?")[0]}?url=`

    const rewritten = text.split("\n").map(line => {
      const t = line.trim()
      if (!t || t.startsWith("#") || t.startsWith("http")) return line
      if (t.startsWith("//")) return line
      const absolute = new URL(t, baseUrl.origin + baseUrl.pathname).href
      return `${proxyBase}${encodeURIComponent(absolute)}`
    }).join("\n")

    return new Response(rewritten, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" },
    })
  }, { detail: { tags: ["Players"], summary: "HLS Proxy" }, query: t.Object({ url: t.String() }) })
