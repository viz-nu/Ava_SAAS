import { conversationTypeDefs } from './conversations/schema.js';
import { conversationResolvers } from './conversations/resolvers.js';
import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';

const typeDefs = mergeTypeDefs([conversationTypeDefs]);
const resolvers = mergeResolvers([conversationResolvers]);



import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { authForGraphQL } from '../middleware/auth.js';

export const registerApollo = async (app, httpServer) => {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    // Error formatting (optional)
    formatError: (error) => {
      console.error('GraphQL Error:', error);
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        if (error.message.includes('Authentication') || error.message.includes('permission')) {
          return error;
        }
        return new Error('Internal server error');
      }

      return error;
    },
  });

  await apolloServer.start();

  app.use(
    '/graphql/conversations',
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        return authForGraphQL(req, res)
      },
    })
  );
};
