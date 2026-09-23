import { Elysia } from "elysia"
import { yoga } from "@elysia/graphql-yoga"
import { typeDefs } from "./schema"
import { queryResolvers } from "./resolvers/query"
import { mutationResolvers } from "./resolvers/mutation"
import { createContext } from "./context"

const resolvers = {
  ...queryResolvers,
  ...mutationResolvers,
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
