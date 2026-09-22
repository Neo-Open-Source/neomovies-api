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

export const graphqlPlugin = new Elysia().use(
  yoga({
    path: "/graphql",
    typeDefs,
    resolvers,
    context: async ({ request }) => createContext(request),
  }),
)
