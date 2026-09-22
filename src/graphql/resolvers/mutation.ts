import { neoid } from "../../services/neoid"
import { userData } from "../../services/user-data"
import { config } from "../../config"
import { requireAuth, type GraphQLContext } from "../context"

export const mutationResolvers = {
  Mutation: {
    refreshTokens: async (_: any, args: Record<string, any>) => {
      const tokens = await neoid.refreshTokens(args.refreshToken)
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
      }
    },

    updateProfile: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      if (!ctx.authorization) throw new Error("Unauthorized")

      const res = await fetch(`${config.neoId.issuer}/api/v1/user/profile`, {
        method: "PUT",
        headers: {
          Authorization: ctx.authorization,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: args.name, avatar: args.avatar }),
      })
      if (!res.ok) throw new Error("Failed to update profile")

      const user = await res.json()
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
      }
    },

    logout: async (_: any, __: any, ctx: GraphQLContext) => {
      if (ctx.authorization) {
        await fetch(`${config.neoId.issuer}/api/v1/auth/logout`, {
          method: "POST",
          headers: { Authorization: ctx.authorization },
        }).catch(() => {})
      }
      return true
    },

    deleteAccount: async (_: any, __: any, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      if (!ctx.authorization) throw new Error("Unauthorized")

      const res = await fetch(`${config.neoId.issuer}/api/v1/user/delete`, {
        method: "DELETE",
        headers: { Authorization: ctx.authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error("Failed to delete account")
      return true
    },

    addFavorite: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      const mediaType = args.mediaType ?? "movie"
      return userData.addFavorite(userId, args.mediaId, mediaType)
    },

    removeFavorite: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      const mediaType = args.mediaType ?? "movie"
      await userData.removeFavorite(userId, args.mediaId, mediaType)
      return true
    },

    addToWatchLater: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.addWatchLater(userId, args.mediaId)
    },

    removeFromWatchLater: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      await userData.removeWatchLater(userId, args.mediaId)
      return true
    },

    upsertProgress: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.upsertProgress(userId, {
        mediaId: args.mediaId,
        mediaType: args.mediaType ?? "movie",
        season: args.season,
        episode: args.episode,
        progress: args.progress,
      })
    },

    deleteProgress: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      await userData.deleteProgress(userId, {
        mediaId: args.mediaId,
        mediaType: args.mediaType ?? "movie",
        season: args.season,
        episode: args.episode,
      })
      return true
    },

    batchSyncProgress: async (_: any, args: Record<string, any>, ctx: GraphQLContext) => {
      const userId = requireAuth(ctx)
      return userData.batchUpsertProgress(userId, args.items)
    },
  },
}
