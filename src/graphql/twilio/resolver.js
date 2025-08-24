import { Integration } from "../../models/Integrations.js";
import { TwilioService } from "../../utils/twilio.js";
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
        makeTwilioOutboundCall: async (_, { integrationId, to, from, twiml, record, transcribe, statusCallback = `${process.env.SERVER_URL}webhook/twilio/call/status`, timeout, machineDetection, machineDetectionTimeout, recordingStatusCallback = `${process.env.SERVER_URL}webhook/twilio/call/status`, transcribeCallback = `${process.env.SERVER_URL}webhook/twilio/call/status` }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.makeOutboundCall({ to, from, twiml, record, transcribe, transcribeCallback, statusCallback, timeout, machineDetection, machineDetectionTimeout, recordingStatusCallback });
        },
        makeTwilioAIOutboundCall: async (_, { integrationId, to, agentId }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const callDetails = await service.makeOutboundCall({ to, from: integration.config.phoneNumber, url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/agent-media-stream` || integration.config.domain, agentId, integrationId });

            await Conversation.create({
                business: integration.business,
                integration: integration.type,
                integrationFullDetails: integration._id,
                voiceCallIdentifierNumberSID: callDetails.sid,
                agent: agentId,
                contact: { phone: to },
                metadata: { status: "initiated", callDetails }
            });
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
