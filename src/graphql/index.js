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
import { ApolloServerPluginLandingPageProductionDefault } from '@apollo/server/plugin/landingPage/default';
// import { zohoTypeDefs } from './zoho/schema.js';
// import { zohoResolvers } from './zoho/resolver.js';
import { actionResolvers } from './actions/resolvers.js';
import { actionTypeDefs } from './actions/schema.js';
import { agentResolvers } from './agents/resolvers.js';
import { agentTypeDefs } from './agents/schema.js';
import { collectionResolvers } from './collections/resolvers.js';
import { collectionTypeDefs } from './collections/schema.js';
import { IntegrationTypeDefs } from './integrations/schema.js';
import { IntegrationResolvers } from './integrations/resolver.js';
import { jobResolvers } from './job/resolver.js';
import { jobTypeDefs } from './job/schema.js';
import { messageTypeDefs } from './messages/schema.js';
import { messageResolvers } from './messages/resolver.js';
import { leadTypeDefs } from './leads/schema.js';
import { leadResolvers } from './leads/resolver.js';
const typeDefs = mergeTypeDefs([
  scopeAuthDirectiveTypeDefs,
  sharedTypeDefs,
  conversationTypeDefs,
  twilioTypeDefs,
  channelTypeDefs,
  ticketTypeDefs,
  notificationTypeDefs,
  userTypeDefs,
  IntegrationTypeDefs,
  // zohoTypeDefs,
  agentTypeDefs,
  actionTypeDefs,
  collectionTypeDefs,
  jobTypeDefs,
  messageTypeDefs,
  leadTypeDefs
]);
const resolvers = mergeResolvers([
  conversationResolvers,
  twilioResolvers,
  channelResolvers,
  ticketResolvers,
  notificationResolvers,
  userResolvers,
  IntegrationResolvers,
  // zohoResolvers,
  agentResolvers,
  actionResolvers,
  collectionResolvers,
  jobResolvers,
  messageResolvers,
  leadResolvers
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
    formatResponse: (response, requestContext) => {
      if (response.errors) {
        return response; // handled by formatError above
      }
      // Function to recursively remove __typename fields
      const removeTypename = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(removeTypename);
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key !== '__typename') {
            cleaned[key] = removeTypename(value);
          }
        }
        return cleaned;
      };
      return {
        success: true,
        message: "OK",
        data: removeTypename(response.data),
      };
    },
    formatError: (error) => {
      console.error('GraphQL Error Details:', { message: error.message, code: error.extensions?.code });
      switch (error.code) {
        case 20003:
          return new GraphQLError("Authentication failed - check your credentials.", { extensions: { code: 'AUTHENTICATION_FAILED' } });
        case 21211:
          return new GraphQLError("Invalid phone number format.", { extensions: { code: 'INVALID_PHONE_NUMBER' } });
        case 21408:
          return new GraphQLError("Permission denied - check account permissions.", { extensions: { code: 'INVALID_ACCESS' } });
        case 21610:
          return new GraphQLError("Message body is required.", { extensions: { code: 'MESSAGE_BODY_REQUIRED' } });
        case 30007:
          return new GraphQLError("Message delivery failed.", { extensions: { code: 'MESSAGE_DELIVERY_FAILED' } });
      }
      if (error.status === 400) return new GraphQLError("Bad Request - Invalid parameters.", { extensions: { code: 'BAD_REQUEST' } });
      if (error.status === 401) return new GraphQLError("Unauthorized - Authentication failed.", { extensions: { code: 'UNAUTHORIZED' } });
      if (error.status === 403) return new GraphQLError("Forbidden - Insufficient permissions.", { extensions: { code: 'FORBIDDEN' } });
      if (error.status === 429) return new GraphQLError("Too Many Requests - Rate limited.", { extensions: { code: 'RATE_LIMITED' } });
      if (error.message.includes('Context creation failed')) return new GraphQLError('Authentication service unavailable', { extensions: { code: 'AUTH_SERVICE_UNAVAILABLE' } });
      return new GraphQLError(error.message, { extensions: { code: error.code || error.extensions?.code }, });
    },
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer }), ApolloServerPluginLandingPageProductionDefault({ embed: true })],
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