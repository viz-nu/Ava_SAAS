import { conversationTypeDefs } from './conversations/schema.js';
import { conversationResolvers } from './conversations/resolvers.js';
import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import cors from 'cors';
const typeDefs = mergeTypeDefs([conversationTypeDefs]);
const resolvers = mergeResolvers([conversationResolvers]);



import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { authForGraphQL } from '../middleware/auth.js';
import { corsOptions } from '../server.js';
import 'dotenv/config'
export const registerApollo = async (app, httpServer) => {
  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    // Error formatting (optional)
    formatError: (error) => {
      // Log full error details for debugging
      console.error('GraphQL Error Details:', { message: error.message, code: error.extensions?.code, path: error.path, locations: error.locations, stack: error.stack, timestamp: new Date().toISOString() });
      // Handle specific error types
      if (error.message.includes('Context creation failed')) return new Error('Authentication service unavailable');
      if (process.env.NODE_ENV === 'production') {
        // Only expose safe errors in production
        const safeErrors = ['Authentication failed', 'Invalid token', 'Token expired', 'Unauthorized', 'Forbidden'];
        if (safeErrors.some(safe => error.message.includes(safe))) return error;
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
        try {
          const authResult = await authForGraphQL(req, res);
          return authResult;
        } catch (error) {
          console.error('Auth error details:', { message: error.message, stack: error.stack, headers: req.headers, body: req.body });
          // Re-throw with more specific error
          if (error.message === 'Internal Server Error') throw new Error('Authentication failed: Unable to verify credentials');
          throw error;
        }
      },
    })
  )
}