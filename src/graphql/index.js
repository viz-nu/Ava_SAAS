import { conversationTypeDefs } from './conversations/schema.js';
import { conversationResolvers } from './conversations/resolvers.js';
import { userTypeDefs } from './users/schema.js';
import { userResolvers } from './users/resolvers.js';
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
import { corsOptions, openCors } from '../server.js';
import cors from 'cors'
import { ticketResolvers } from './tickets/resolver.js';
import { ticketTypeDefs } from './tickets/schema.js';
import { notificationTypeDefs } from './notifications/schema.js';
import { notificationResolvers } from './notifications/resolver.js';
import {  ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
const typeDefs = mergeTypeDefs([
  scopeAuthDirectiveTypeDefs,
  sharedTypeDefs,
  conversationTypeDefs,
  twilioTypeDefs,
  channelTypeDefs,
  ticketTypeDefs,
  notificationTypeDefs,
  userTypeDefs
]);
const resolvers = mergeResolvers([
  conversationResolvers,
  twilioResolvers,
  channelResolvers,
  ticketResolvers,
  notificationResolvers,
  userResolvers
]);
export const registerApollo = async (app, httpServer) => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });
  const schemaWithDirectives = applyScopeAuthDirectives(schema);
  const apolloServer = new ApolloServer({
    schema: schemaWithDirectives,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }),ApolloServerPluginLandingPageProductionDefault({ embed: true }) ],
    formatError: (error) => {
      console.error('GraphQL Error Details:', { message: error.message, code: error.extensions?.code, path: error.path, locations: error.locations, stack: error.stack, timestamp: new Date().toISOString() });
      if (error.message.includes('Context creation failed')) return new GraphQLError('Authentication service unavailable', { extensions: { code: 'AUTH_SERVICE_UNAVAILABLE' } });
      if (process.env.NODE_ENV === 'production') {
        const safeErrors = ['Authentication failed', 'Invalid token', 'Token expired', 'Unauthorized', 'Forbidden'];
        if (safeErrors.some(safe => error.message.includes(safe))) return error;
        return new GraphQLError('Internal server error', { extensions: { code: 'INTERNAL_SERVER_ERROR' }, });
      }
      return error;
    },
  });
  await apolloServer.start();
  app.use(
    '/graphql',
    cors(corsOptions),
    expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        try {
          if (req.method === 'POST' && req.body?.operationName === 'IntrospectionQuery') return {}
          const authResult = await authForGraphQL(req, res);
          return authResult;
        } catch (error) {
          console.error('Auth error details:', { message: error.message, stack: error.stack, headers: req.headers, body: req.body });
          if (error.message === 'Internal Server Error') throw new Error('Authentication failed: Unable to verify credentials');
          throw error;
        }
      },
    })
  )
}