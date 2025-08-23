import { Integration } from "../../models/Integrations.js";
import { TwilioService } from "../../utils/twilio.js";
// Assuming user access tokens are passed via context
const { DOMAIN, TWILIO_AUTH_TOKEN } = process.env;
export const twilioResolvers = {
    Query: {
        listAvailableNumbers: async (_, { integrationId, country = 'US', type = ['local'], areaCode = null, contains = null, limit = 3 }, context) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const result = await service.listAvailableNumbersWithPricing(country, type, areaCode, contains, limit);
            return result
        },
        listOwnedPhoneNumbers: async (_, { integrationId, limit }, context) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.listOwnedPhoneNumbers(limit);
        },
        fetchBalance: async (_, { integrationId }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.fetchBalance();
        },
        listConnectApps: async (_, { integrationId }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.listConnectApps();
        },
        getSmsStatus: async (_, { integrationId, sid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.SmsStatus(sid);
        },
        getMessages: async (_, { integrationId, limit = 5, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) => {
            //             /** Filter by recipient. For example: Set this `to` parameter to `+15558881111` to retrieve a list of Message resources with `to` properties of `+15558881111` */
            // to?: string;
            // /** Filter by sender. For example: Set this `from` parameter to `+15552229999` to retrieve a list of Message resources with `from` properties of `+15552229999` */
            // from?: string;
            // /** Filter by Message `sent_date`. Accepts GMT dates in the following formats: `YYYY-MM-DD` (to find Messages with a specific `sent_date`), `<=YYYY-MM-DD` (to find Messages with `sent_date`s on and before a specific date), and `>=YYYY-MM-DD` (to find Messages with `sent_dates` on and after a specific date). */
            // dateSent?: Date;
            // /** Filter by Message `sent_date`. Accepts GMT dates in the following formats: `YYYY-MM-DD` (to find Messages with a specific `sent_date`), `<=YYYY-MM-DD` (to find Messages with `sent_date`s on and before a specific date), and `>=YYYY-MM-DD` (to find Messages with `sent_dates` on and after a specific date). */
            // dateSentBefore?: Date;
            // /** Filter by Message `sent_date`. Accepts GMT dates in the following formats: `YYYY-MM-DD` (to find Messages with a specific `sent_date`), `<=YYYY-MM-DD` (to find Messages with `sent_date`s on and before a specific date), and `>=YYYY-MM-DD` (to find Messages with `sent_dates` on and after a specific date). */
            // dateSentAfter?: Date;
            // /** How many resources to return in each list page. The default is 50, and the maximum is 1000. */
            // pageSize?: number;
            // /** Upper limit for the number of records to return. list() guarantees never to return more than limit. Default is no limit */
            // limit?: number;
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const messages = await service.listMessages({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
            console.log(messages);
            return messages
        }
    },
    Mutation: {
        buyPhoneNumber: async (_, { integrationId, phoneNumber, friendlyName }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.buyPhoneNumber(phoneNumber, friendlyName);
        },
        releasePhoneNumber: async (_, { integrationId, sid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.releasePhoneNumber(sid);
        },
        makeOutboundCall: async (_, { integrationId, to, from, twimlUrl }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.makeOutboundCall({ to, from, twimlUrl });
        },
        makeAIOutboundCall: async (_, { integrationId, to, agentId }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            const callDetails = await service.makeOutboundCall({ to, from: integration.config.phoneNumber, url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/agent-media-stream` || integration.config.domain, agentId, integrationId });
            //             sid: Unique identifier for the call(e.g., "CAxxxxxxxxxxxxxxxxxxxxxxxxxx")
            // status: Current call status - typically starts as "queued", then "ringing", "in-progress", "completed", etc.
            //                 to: The destination phone number
            //             from: The source phone number(your Twilio number)
            //             date_created: When the call was initiated
            //             duration: Call duration(null initially, populated after call ends)
            //             price: Cost of the call(null initially, populated after call ends)
            //             direction: "outbound-api" for calls made via API
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
        sendSms: async (_, { integrationId, to, from, body }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            return await service.sendSms({ to, from, body });  // ✅ fixed spreading
        },
        deAuthorizeApp: async (_, { integrationId, connectAppSid }) => {
            const integration = await Integration.findById(integrationId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(integration.config.AccountSid, TWILIO_AUTH_TOKEN);
            await service.deauthorizeConnectApp(connectAppSid);
            return true;
        },
    }
};
