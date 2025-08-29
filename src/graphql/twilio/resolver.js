import { Conversation } from "../../models/Conversations.js";
import { Integration } from "../../models/Integrations.js";
import { TwilioService } from "../../utils/twilio.js";
import { Channel } from '../../models/Channels.js';
import { AgentModel } from "../../models/Agent.js";
import { GraphQLError } from "graphql";
// Assuming user access tokens are passed via context
const { DOMAIN, TWILIO_AUTH_TOKEN } = process.env;
export const twilioResolvers = {
    Query: {
        getTwilioAccountDetails: async (_, { integrationId }, context) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            let accountDetails = JSON.parse(JSON.stringify(await service.getAccountDetails()));
            await Integration.findByIdAndUpdate(integrationId, { $set: { accountDetails } });
            return accountDetails;
        },
        listTwilioAvailableNumbers: async (_, { integrationId, country = 'US', type = ['local'], options }, context) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.listAvailableNumbersWithPricing({ country, type, options });
        },
        listTwilioOwnedPhoneNumbers: async (_, { integrationId, limit }, context) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.listOwnedPhoneNumbers(limit);
        },
        getTwilioSmsStatus: async (_, { integrationId, sid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.SmsStatus(sid);
        },
        getTwilioCalls: async (_, { integrationId, limit = 5, to, from, startTime, endTime, status, }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const calls = await service.listCalls({ limit, to, from, startTime, endTime, status });
            return calls;
        },
        getTwilioMessages: async (_, { integrationId, limit = 5, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.listMessages({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
        },
        getTwilioCallRecordings: async (_, { integrationId, callSid, dateCreated, limit }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const recordings = await service.getRecording({ callSid, dateCreated, limit });
            return recordings;
        },
        getTwilioUsageRecords: async (_, { integrationId, category = "calls", startDate, endDate, limit }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.fetchUsageRecords({ category, startDate, endDate, limit });;
        },
        getTwilioUsageRecordsTimely: async (_, { integrationId, limit, Instance = "allTime", year }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.getTwilioUsageRecordsTimely({ limit, Instance, year });;
        },
        getTwilioPricing: async (_, { integrationId, country = 'US', twilioService }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.getPricing(country, twilioService);
        },
        getTwilioTranscriptions: async (_, { integrationId, limit = 10 }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const Transcriptions = await service.listTranscriptions({ limit });
            console.log(JSON.stringify(Transcriptions, null, 2));
            return Transcriptions;
        },
    },
    Mutation: {
        buyTwilioPhoneNumber: async (_, { integrationId, phoneNumber, friendlyName, smsUrl, voiceUrl }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.buyPhoneNumber(phoneNumber, friendlyName, smsUrl = `${process.env.SERVER_URL}webhook/twilio/sms/status`, voiceUrl = `${process.env.SERVER_URL}webhook/twilio/call/status`);
        },
        updateTwilioPhoneNumber: async (_, { integrationId, sid, friendlyName, voiceUrl, voiceMethod, smsUrl, smsMethod, voiceCallerIdLookup, accountSid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.updatePhoneNumber(sid, { friendlyName, voiceUrl, voiceMethod, smsUrl, smsMethod, voiceCallerIdLookup, accountSid });
        },
        releaseTwilioPhoneNumber: async (_, { integrationId, sid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.releasePhoneNumber(sid);
        },
        makeTwilioOutboundTestCall: async (_, { channelId, to }) => {
            const channel = await Channel.findById(channelId, "config")
            await Integration.populate(channel, [{ path: "config.integration", select: "config secrets" }])
            const service = new TwilioService(channel.config.integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.makeOutboundCall({ to, from });
        },
        makeTwilioAIOutboundCall: async (_, { channelId, to, agentId, PreContext }) => {
            const channel = await Channel.findById(channelId, "config")
            const agentDetails = await AgentModel.findById(agentId, "personalInfo.model")
            console.log({ channel, agentDetails });
            if (!agentDetails) new GraphQLError("invalid Agent model", { extensions: { code: "INVALID_AGENT_ID" } })
            // if (!['gpt-4o-realtime-preview', 'gpt-4o-mini-realtime-preview', 'gpt-4o-realtime-preview-2025-06-03', 'gpt-4o-realtime-preview-2024-12-17', 'gpt-4o-realtime-preview-2024-10-01', 'gpt-4o-mini-realtime-preview-2024-12-17'].includes(agentDetails.personalInfo.model)) new GraphQLError("invalid Agent model", { extensions: { code: "INVALID_AGENT_ID" } })
            if (!channel) new GraphQLError("invalid channelId", { extensions: { code: "INVALID_CHANNEL_ID" } })
            await Integration.populate(channel, [{ path: "config.integration", select: "config secrets" }])
            const service = new TwilioService(channel.config.integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const model = agentDetails.personalInfo.model;
            const conversation = await Conversation.create({ business: channel.business, channel: channel.type, channelFullDetails: channelId, agent: agentId, PreContext, contact: { phone: to }, metadata: { status: "initiated" } });
            const callDetails = await service.makeAIOutboundCall({ to, from: channel.config.phoneNumber, url: channel.config.webSocketsUrl, webhookUrl: channel.config.voiceUpdatesWebhookUrl + conversation._id.toString(), agentId, conversationId: conversation._id.toString(), model });
            conversation.voiceCallIdentifierNumberSID = callDetails.sid;
            conversation.metadata.callDetails = { ...JSON.parse(JSON.stringify(callDetails || {})) };
            await conversation.save();
            return callDetails;
        },
        sendTwilioSms: async (_, { integrationId, to, from, body, mediaUrl, statusCallback = `${process.env.SERVER_URL}webhook/twilio/sms/status` }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.sendSms({ to, from, body, mediaUrl, statusCallback });
        },
        deAuthorizeTwilioApp: async (_, { integrationId, connectAppSid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            await service.deauthorizeConnectApp(connectAppSid);
            return true;
        },
    }
};
