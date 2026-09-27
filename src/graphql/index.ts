import { Elysia } from "elysia"
import { yoga } from "@elysia/graphql-yoga"
import { typeDefs } from "./schema"
import { queryResolvers } from "./resolvers/query"
import { mutationResolvers } from "./resolvers/mutation"
import { createContext } from "./context"

const resolvers = {
  ...queryResolvers,
  ...mutationResolvers,
  // Unions/interfaces need runtime type resolution when objects lack __typename.
  SearchItem: {
    // Multi-search mixes MediaItem (title) with PersonSearchItem (name only).
    __resolveType: (obj: { mediaType?: string; title?: string; name?: string }) => {
      if (obj.mediaType === "person") return "PersonSearchItem"
      if (obj.title !== undefined) return "MediaItem"
      if (obj.name !== undefined) return "PersonSearchItem"
      return "MediaItem"
    },
  },
  MediaDetail: {
    // Query.media sets __typename; this is a fallback if a resolver forgets it.
    __resolveType: (obj: { __typename?: string; seasons?: unknown[]; networks?: unknown[] }) => {
      if (obj.__typename) return obj.__typename
      if (obj.seasons !== undefined || obj.networks !== undefined) return "TVDetail"
      return "MovieDetail"
    },
  },
  MediaFields: {
    __resolveType: (obj: { __typename?: string; mediaId?: number; createdAt?: string }) => {
      if (obj.__typename) return obj.__typename
      // FavoriteMediaItem carries mediaId/createdAt; plain lists are MediaItem.
      if (obj.mediaId !== undefined && obj.createdAt !== undefined) return "FavoriteMediaItem"
      return "MediaItem"
    },
  },
}

// Cast yoga() to any — @elysia/graphql-yoga infers deeply recursive resolver
// types that cause TS2589 ("instantiation excessively deep") when combined
// with Elysia's plugin chain. The runtime behaviour is unaffected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yogaPlugin: any = (yoga as any)({
  path: "/graphql",
  typeDefs,
  resolvers: resolvers as any,
  context: async ({ request }: { request: Request }) => createContext(request),
  graphiql: {
    title: "NeoWatch GraphQL Playground",
  },
})

export const graphqlPlugin = new Elysia().use(yogaPlugin)
