import { GraphQLError } from "graphql";
import { Integration } from "../../models/Integrations.js";
import { ZohoCRMIntegration } from "../../utils/Zoho.js";
import graphqlFields from "graphql-fields";
import { flattenFields } from "../../utils/graphqlTools.js";
import { TwilioService } from "../../utils/twilio.js";
import { Business } from "../../models/Business.js";
import { User } from "../../models/User.js";
import { Channel } from "../../models/Channels.js";
import { AgentModel } from "../../models/Agent.js";
const { TWILIO_AUTH_TOKEN } = process.env;
export const IntegrationResolvers = {
    Query: {
        fetchIntegration: async (_, { id, limit = 5 }, context, info) => {
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const integration = await Integration.find(filter).select(projection).limit(limit).sort({ createdAt: -1 });
            await Business.populate(integration, { path: 'business', select: nested.business });
            await User.populate(integration, { path: 'createdBy', select: nested.createdBy });
            return integration;
        }
    },
    Mutation: {
        createIntegration: async (_, { code, domain, type, name, purpose, AccountSid, state }, context, info) => {
            let integration
            switch (type) {
                case "zoho":
                    const zohoCRM = new ZohoCRMIntegration();
                    const { success, data } = await zohoCRM.getTokens(code, domain);
                    if (!success) return new GraphQLError('invalid code or domin', { extensions: { code: 'INVALID_INPUT' } });
                    integration = await Integration.create({
                        business: context.user.business,
                        metaData: {
                            name: name || 'Zoho CRM',
                            description: 'Zoho CRM',
                            icon: 'https://www.zoho.com/favicon.ico',
                            color: '#000000',
                            purpose: 'crm',
                            type
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
                    const service = new TwilioService(AccountSid, TWILIO_AUTH_TOKEN);
                    let accountDetails = JSON.parse(JSON.stringify(await service.getAccountDetails()));
                    integration = await Integration.create({
                        business: context.user.business,
                        metaData: {
                            name: name || 'Twilio',
                            description: 'Twilio SMS and Voice',
                            icon: 'https://www.svgrepo.com/show/354472/twilio-icon.svg',
                            color: '#000000',
                            purpose: purpose || 'voice and sms',
                            type
                        },
                        config: {
                            AccountSid: AccountSid,
                            state: state,
                        },
                        secrets: {
                            tokenType: "Barer",
                            accessToken: TWILIO_AUTH_TOKEN,
                        },
                        accountDetails: accountDetails,
                        isActive: true,
                        createdBy: context.user._id
                    })
                    break
                default:
                    break;
            }
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            await Business.populate(integration, { path: 'business', select: nested.business });
            await User.populate(integration, { path: 'createdBy', select: nested.createdBy });
            return integration;
        },
        deAuthorizeIntegration: async (_, { integrationId }, context, info) => {
            const integration = await Integration.findOne({ _id: integrationId, business: context.user.business });
            if (!integration) return new GraphQLError('Integration not found', { extensions: { code: 'NOT_FOUND' } });
            switch (integration.metaData.type) {
                case "twilio":
                    const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
                    await service.deauthorizeConnectApp(integration.config.AccountSid);
                    // remove channel connected to integration 
                    const deletedChannel = await Channel.findOneAndDelete({ "config.integration": id, business: context.user.business });
                    if (deletedChannel) {
                        console.log("Deleted channel id:", deletedChannel._id);
                        await AgentModel.updateMany({ channels: deletedChannel._id }, { $pull: { channels: deletedChannel._id } });
                    }
                    break;
                default:
                    break;
            }
            await Integration.deleteOne({ _id: integrationId });
            return true;
        },

    }
}