import { Channel } from "../../models/Channels.js";
import { TwilioService } from "../../utils/twilio.js";
// Assuming user access tokens are passed via context
const { DOMAIN } = process.env;
export const twilioResolvers = {
    Query: {
        listAvailableNumbers: async (_, { channelId, country = 'US', type = ['local'], areaCode = null, contains = null, limit = 3 }, context) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            const result = await service.listAvailableNumbersWithPricing(country, type, areaCode, contains, limit);
            return result
        },
        listOwnedPhoneNumbers: async (_, { channelId, limit }, context) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.listOwnedPhoneNumbers(limit);
        },
        fetchBalance: async (_, { channelId }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.fetchBalance();
        },
        listConnectApps: async (_, { channelId }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.listConnectApps();
        },
        getSmsStatus: async (_, { channelId, sid }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.SmsStatus(sid);
        },
        getMessages: async (_, { channelId, limit = 5, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) => {
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
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            const messages = await service.listMessages({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
            console.log(messages);
            return messages
        }
    },
    Mutation: {
        buyPhoneNumber: async (_, { channelId, phoneNumber, friendlyName }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.buyPhoneNumber(phoneNumber, friendlyName);
        },
        releasePhoneNumber: async (_, { channelId, sid }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.releasePhoneNumber(sid);
        },
        makeOutboundCall: async (_, { channelId, to, from, twimlUrl }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.makeOutboundCall({ to, from, twimlUrl });
        },
        // makeAIOutboundCall: async (_, { channelId, to, from, twimlUrl }) => {
        //     const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
        //     const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
        //     return await service.makeOutboundCall({ to, from, twimlUrl });
        // },
        sendSms: async (_, { channelId, to, from, body }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            return await service.sendSms({ to, from, body });  // ✅ fixed spreading
        },
        deAuthorizeApp: async (_, { channelId, connectAppSid }) => {
            const channel = await Channel.findById(channelId).select({ config: 1, secrets: 1 }).lean();
            const service = new TwilioService(channel.config.AccountSid, channel.secrets.accessToken);
            await service.deauthorizeConnectApp(connectAppSid);
            return true;
        },
    }
};
