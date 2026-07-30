import { Elysia, t } from "elysia"
import { config } from "../../config"
import { success } from "../../lib/response"
import { BadRequestError } from "../../lib/errors"

export const collapsRoutes = new Elysia()

  .get("/api/v1/player/collaps/kp/:kpId", async ({ params: { kpId }, query }) => {
    if (!config.collaps.host || !config.collaps.token) throw new BadRequestError("Collaps not configured")

    const season = query.season ? parseInt(String(query.season)) : undefined
    const episode = query.episode ? parseInt(String(query.episode)) : undefined

    const listUrl = `${config.collaps.host.replace(/\/$/, "")}/list?token=${config.collaps.token}&kinopoisk_id=${kpId}`
    const res = await fetch(listUrl)
    if (!res.ok) throw new BadRequestError("Video not found on Collaps")

    const data: any = await res.json()
    const result = data?.results?.[0]
    if (!result) throw new BadRequestError("No results from Collaps")

    let iframeUrl: string | null = null

    if (result.type === "series") {
      const seasons = result.seasons ?? []
      if (season != null && episode != null) {
        const s = seasons.find((s: any) => s.season === season)
        iframeUrl = s?.episodes?.find((e: any) => {
          const en = typeof e.episode === "string" ? parseInt(e.episode) : e.episode
          return en === episode
        })?.iframe_url ?? null
      } else if (season != null) {
        const s = seasons.find((s: any) => s.season === season)
        iframeUrl = s?.episodes?.[0]?.iframe_url ?? null
      } else {
        iframeUrl = result.iframe_url ?? seasons[0]?.episodes?.[0]?.iframe_url ?? null
      }
    } else {
      iframeUrl = result.iframe_url ?? null
    }

    if (!iframeUrl) throw new BadRequestError("No iframe URL found")

    return success({ provider: "Collaps", url: iframeUrl, type: "iframe" })
  }, { detail: { tags: ["Players"], summary: "Collaps Player" }, params: t.Object({ kpId: t.Numeric() }), query: t.Object({ season: t.Optional(t.String()), episode: t.Optional(t.String()) }) })
