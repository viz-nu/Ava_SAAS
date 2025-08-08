import { conversationTypeDefs } from './conversations/schema.js';
import { conversationResolvers } from './conversations/resolvers.js';
import { agentTypeDefs } from './agents/schema.js';
import { agentResolvers } from './agents/resolvers.js';
import { collectionTypeDefs } from './collections/schema.js';
import { collectionResolvers } from './collections/resolvers.js';
import { businessTypeDefs } from './business/schema.js';
import { businessResolvers } from './business/resolvers.js';
import { analyticsTypeDefs } from './analytics/schema.js';
import { analyticsResolvers } from './analytics/resolvers.js';
import { userTypeDefs } from './users/schema.js';
import { userResolvers } from './users/resolvers.js';
import { authTypeDefs } from './auth/schema.js';
import { authResolvers } from './auth/resolvers.js';
import { sharedTypeDefs } from './shared/types.js';
import { twilioResolvers } from './twilio/resolver.js';
import { scopeAuthDirectiveTypeDefs, applyScopeAuthDirectives } from './directives/scopeAuth.js';
import { mergeResolvers, mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { twilioTypeDefs } from './twilio/schema.js';
import { channelResolvers } from './channels/resolver.js';
import { channelTypeDefs } from './channels/schema.js';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { authForGraphQL } from '../middleware/auth.js';
import 'dotenv/config'
import { GraphQLError } from 'graphql';
import { corsOptions } from '../server.js';
import cors from 'cors'
// Merge all type definitions
const typeDefs = mergeTypeDefs([
  scopeAuthDirectiveTypeDefs,
  sharedTypeDefs,
  conversationTypeDefs,
  twilioTypeDefs,
  channelTypeDefs,
  // agentTypeDefs,
  // collectionTypeDefs,
  // businessTypeDefs,
  // analyticsTypeDefs,
  userTypeDefs,
  // authTypeDefs
]);
// Merge all resolvers
const resolvers = mergeResolvers([
  conversationResolvers,
  twilioResolvers,
  channelResolvers,
  // agentResolvers,
  // collectionResolvers,
  // businessResolvers,
  // analyticsResolvers,
  userResolvers,
  // authResolvers
]);
export const registerApollo = async (app, httpServer) => {
  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });
  // Apply scope-based authorization directives
  const schemaWithDirectives = applyScopeAuthDirectives(schema);
  const apolloServer = new ApolloServer({
    schema: schemaWithDirectives,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    // Error formatting (optional)
    formatError: (error) => {
      // Log full error details for debugging
      console.error('GraphQL Error Details:', { message: error.message, code: error.extensions?.code, path: error.path, locations: error.locations, stack: error.stack, timestamp: new Date().toISOString() });
      // Handle specific error types

      // Replace generic error if context creation fails
      if (error.message.includes('Context creation failed')) {
        return new GraphQLError('Authentication service unavailable', {
          extensions: { code: 'AUTH_SERVICE_UNAVAILABLE' },
        });
      }

      if (process.env.NODE_ENV === 'production') {
        const safeErrors = ['Authentication failed', 'Invalid token', 'Token expired', 'Unauthorized', 'Forbidden'];
        if (safeErrors.some(safe => error.message.includes(safe))) return error;

        // Return a sanitized error
        return new GraphQLError('Internal server error', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
      return error;
    },
  });

  await apolloServer.start();
  app.use(
    '/graphql',cors(corsOptions),
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