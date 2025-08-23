import { GraphQLError } from "graphql";
import { Integration } from "../../models/Integrations.js";
import { ZohoCRMIntegration } from "../../utils/Zoho.js";
import graphqlFields from "graphql-fields";
import { flattenFields } from "../../utils/graphqlTools.js";
import { TwilioService } from "../../utils/twilio.js";
const { TWILIO_AUTH_TOKEN } = process.env;
export const IntegrationResolvers = {
    Query: {
        fetchIntegration: async (_, { id, limit = 5 }, context, info) => {
            const filter = { business: context.business._id };
            if (id) filter._id = id;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const integration = await Integration.find(filter).populate('business createdBy').select(projection).limit(limit).sort({ createdAt: -1 });;
            return integration;
        }
    },
    Mutation: {
        createIntegration: async (_, { code, domain, type, AccountSid, state }, context, info) => {
            let integration
            switch (type) {
                case "zoho":
                    const zohoCRM = new ZohoCRMIntegration();
                    const { success, data } = await zohoCRM.getTokens(code, domain);
                    if (!success) return new GraphQLError('invalid code or domin', { extensions: { code: 'INVALID_INPUT' } });
                    integration = await Integration.create({
                        business: context.user.business,
                        metaData: {
                            name: 'Zoho CRM',
                            description: 'Zoho CRM',
                            icon: 'https://www.zoho.com/favicon.ico',
                            color: '#000000',
                            purpose: 'crm',
                            type: 'zoho'
                        },
                        secrets: {
                            tokenType: data.token_type,
                            accessToken: data.access_token,
                            refreshToken: data.refresh_token,
                        },
                        config: {
                            apiDomainUrl: data.api_domain,
                            domain: domain,
                            scope: data.scope,
                            expiresAt: new Date(Date.now() + (data.expires_in * 1000))
                        },
                        isActive: true,
                        createdBy: context.user._id
                    });
                    break;
                case "twilio":
                    if (!AccountSid) return new GraphQLError('AccountSid is required for Twilio integration', { extensions: { code: 'INVALID_INPUT' } });
                    integration = await Integration.create({
                        business: context.user.business,
                        metaData: {
                            name: 'Twilio',
                            description: 'Twilio SMS and Voice',
                            icon: 'https://www.svgrepo.com/show/354472/twilio-icon.svg',
                            color: '#000000',
                            purpose: 'voice and sms',
                            type: 'twilio'
                        },
                        config: {
                            AccountSid: AccountSid,
                            state: state,
                        },
                        isActive: true,
                        createdBy: context.user._id
                    })
                    break
                default:
                    break;
            }
            return await integration.populate('business createdBy');
        },
        deAuthorizeIntegration: async (_, { id }, context, info) => {
            const integration = await Integration.findOne({ _id: id, business: context.user.business });
            if (!integration) return new GraphQLError('Integration not found', { extensions: { code: 'NOT_FOUND' } });
            switch (integration.metaData.type) {
                case "twilio":
                    const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
                    await service.deauthorizeConnectApp(connectAppSid);
                    break;
                default:
                    break;
            }
            // await Integration.deleteOne({ _id: id });
            return true;
        },

    }
}