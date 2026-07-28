import { db } from "../db"

export const userData = {
  async listFavorites(userId: string, page: number = 1) {
    const limit = 20
    const [items, total] = await Promise.all([
      db.favorite.findMany({
        where: { userId },
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.favorite.count({ where: { userId } }),
    ])
    return {
      items: items.map(f => ({ mediaId: f.mediaId, mediaType: f.mediaType, createdAt: f.createdAt })),
      page, totalPages: Math.ceil(total / limit), totalResults: total,
    }
  },

  async addFavorite(userId: string, mediaId: number, mediaType: string) {
    const fav = await db.favorite.upsert({
      where: { userId_mediaId_mediaType: { userId, mediaId, mediaType } },
      update: {},
      create: { userId, mediaId, mediaType },
    })
    return { id: fav.id, mediaId: fav.mediaId, mediaType: fav.mediaType }
  },

  async removeFavorite(userId: string, mediaId: number, mediaType: string) {
    await db.favorite.deleteMany({ where: { userId, mediaId, mediaType } })
  },

  async checkFavorite(userId: string, mediaId: number, mediaType: string) {
    const fav = await db.favorite.findUnique({
      where: { userId_mediaId_mediaType: { userId, mediaId, mediaType } },
    })
    return !!fav
  },

  async listWatchLater(userId: string) {
    const items = await db.watchLater.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return items.map(w => ({ mediaId: w.mediaId, createdAt: w.createdAt }))
  },

  async addWatchLater(userId: string, mediaId: number) {
    const wl = await db.watchLater.upsert({
      where: { userId_mediaId: { userId, mediaId } },
      update: {},
      create: { userId, mediaId },
    })
    return { id: wl.id, mediaId: wl.mediaId }
  },

  async removeWatchLater(userId: string, mediaId: number) {
    await db.watchLater.deleteMany({ where: { userId, mediaId } })
  },

  async checkWatchLater(userId: string, mediaId: number) {
    const wl = await db.watchLater.findUnique({
      where: { userId_mediaId: { userId, mediaId } },
    })
    return !!wl
  },

  async getSyncProgress(userId: string) {
    const items = await db.syncProgress.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    })
    return items.map(s => ({
      mediaId: s.mediaId, mediaType: s.mediaType,
      season: s.season, episode: s.episode,
      progress: s.progress, updatedAt: s.updatedAt,
    }))
  },

  async upsertProgress(userId: string, data: { mediaId: number; mediaType?: string; season?: number | null; episode?: number | null; progress: number }) {
    const record = await db.syncProgress.upsert({
      where: {
        userId_mediaId_mediaType_season_episode: {
          userId,
          mediaId: data.mediaId,
          mediaType: data.mediaType || "movie",
          season: data.season as number,
          episode: data.episode as number,
        },
      },
      update: { progress: data.progress },
      create: {
        userId,
        mediaId: data.mediaId,
        mediaType: data.mediaType || "movie",
        season: data.season ?? null,
        episode: data.episode ?? null,
        progress: data.progress,
      },
    })
    return {
      mediaId: record.mediaId, mediaType: record.mediaType,
      season: record.season, episode: record.episode,
      progress: record.progress, updatedAt: record.updatedAt,
    }
  },

  async deleteProgress(userId: string, data: { mediaId: number; mediaType?: string; season?: number | null; episode?: number | null }) {
    await db.syncProgress.deleteMany({
      where: {
        userId,
        mediaId: data.mediaId,
        mediaType: data.mediaType || "movie",
        season: data.season ?? null,
        episode: data.episode ?? null,
      },
    })
  },

  async batchUpsertProgress(userId: string, items: { mediaId: number; mediaType?: string; season?: number | null; episode?: number | null; progress: number }[]) {
    const results = []
    for (const item of items) {
      if (!item.mediaId || item.progress === undefined) continue
      const record = await userData.upsertProgress(userId, { ...item, progress: Math.max(item.progress, 0) })
      results.push(record)
    }
    return { items: results, count: results.length }
  },
}
