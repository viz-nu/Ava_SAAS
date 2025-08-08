// const twilio = require('twilio');

// // Use YOUR auth token, but the USER's account SID
// const client = twilio(userAccountSid, yourAuthToken);

// // Example: Send SMS on behalf of user
// await client.messages.create({
//   body: 'Hello from your app!',
//   from: '+1234567890', // Number bought through user's account
//   to: '+0987654321'
// });

// // Example: Get user's call logs (with read permission)
// const calls = await client.calls.list({ limit: 20 });

import twilio from 'twilio';
export class TwilioService {
    constructor(userAccountSid, userAuthToken) {
            this.client = twilio(userAccountSid, userAuthToken);

        this.accountSid = userAccountSid;
    }
    /** ----------------------------
  *  Phone Numbers
  * -----------------------------*/
    async listAvailableNumbersWithPricing({ country = 'US', type = ['local'], areaCode = null, contains = null, limit = 10 }) {

        let pricing = {};
        const types = Array.isArray(type) ? type : [type];
        try {
            const priceResp = await this.client.pricing.v1.phoneNumbers.countries(country).fetch();
            const typePrices = {};
            priceResp.phoneNumberPrices?.forEach(p => {
                if (types.includes(p.number_type)) typePrices[p.number_type] = { basePrice: p.base_price, currentPrice: p.current_price };
                else if (p.number_type === "toll free" && types.includes("tollFree")) typePrices["tollFree"] = { basePrice: p.base_price, currentPrice: p.current_price };
            });
            pricing = {
                currency: priceResp.priceUnit,   // e.g. "USD"
                types: typePrices             // { local:{…}, mobile:{…}, … }
            };
        } catch (e) {
            console.warn('Could not fetch pricing:', e.message);
        }

        // {
        //   currency: 'USD',
        //   types: { local: { basePrice: '1.15', currentPrice: '1.15' } }
        // }
        const options = { limit: parseInt(limit) };
        if (areaCode) options.areaCode = areaCode;
        if (contains) options.contains = contains;
        let numbers = await Promise.all(types.map(async (t) => {
            try {
                let list = await this.client.availablePhoneNumbers(country)[t].list(options);
                list = list.map(ele => ({ ...ele, cost: { currency: pricing.currency, ...pricing.types[t] } }))
                return list;
            } catch (e) {
                console.warn(`Could not fetch ${t} numbers:`, e.message);
                return [];
            }
        }));
        console.log(numbers);
        return numbers.flat()
    }

    async buyPhoneNumber(phoneNumber, friendlyName) {
        return await this.client.incomingPhoneNumbers.create({ phoneNumber, friendlyName });
    }

    async listOwnedPhoneNumbers(limit = 20) {
        return await this.client.incomingPhoneNumbers.list({ limit });
    }

    async releasePhoneNumber(sid) {
        return await this.client.incomingPhoneNumbers(sid).remove();
    }

    /** ----------------------------
     *  Voice: Outbound & Inbound Calls
     * -----------------------------*/

    async makeOutboundCall({ to, from, twimlUrl }) {
        return await this.client.calls.create({ to, from, url: twimlUrl });// e.g. https://handler.twilio.com/twiml/EHxxx
    }
    async makeAIOutboundCall({ to, from, twimlUrl }) {
        // const { to, _id } = session;
        // const VoiceResponse = this.client.twiml.VoiceResponse;
        // const response = new VoiceResponse();
        // const connect = response.connect();
        // const stream = connect.stream({ url: `wss://${DOMAIN.replace(/^https?:\/\//, '')}/media-stream` });
        // stream.parameter({ name: 'sessionId', value: _id.toString() });
        // const twiml = response.toString();
        return await this.client.calls.create({ to, from, twiml });// e.g. https://handler.twilio.com/twiml/EHxxx
    }
    async listCalls() {
        return await this.client.calls.list({ limit: 20 });
    }

    async getCallDetails(callSid) {
        return await this.client.calls(callSid).fetch();
    }

    async endCall(callSid) {
        return await this.client.calls(callSid).update({ status: 'completed' });
    }

    /** Setup Inbound: You must configure TwiML URL */
    async updateInboundWebhook(phoneNumberSid, webhookUrl) {
        return await this.client.incomingPhoneNumbers(phoneNumberSid).update({ voiceUrl: webhookUrl });

    }
    async listConferences() {
        return await this.client.conferences.list({ limit: 10 });
    }
    async listQueues() {
        return await this.client.queues.list({ limit: 10 });
    }
    /** ----------------------------
     *  SMS Messaging
     * -----------------------------*/

    async sendSms({ to, from, body }) {
        const result = await this.client.messages.create({
            to, from, body,
            statusCallback: `${process.env.SERVER_URL}/webhook/twilio/sms/status`
        });


        return result
    }
    async SmsStatus(sid) {
        const message = await this.client.messages(sid).fetch();
        // queued
        // sent

        // delivered

        // undelivered

        // failed
        return message
    }
    async listMessages({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) {
        return await this.client.messages.list({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
    }

    /** ----------------------------
     *  Usage
     * -----------------------------*/

    async fetchUsageRecords(category = 'calls') {
        return await this.client.usage.records.list({ category, limit: 10 });
    }
    async fetchBalance() {
        const balance = await this.client.balance.fetch();
        return balance;
    }
    async fetchUsageSummary() {
        return await this.client.usage.records.daily.list({ limit: 10 });
    }
    /** ----------------------------
     *  Deauthorize App (Disconnect)
     * -----------------------------*/

    // CONNECT APPS
    async deauthorizeConnectApp(connectAppSid) {
        return await this.client.authorizedConnectApps(connectAppSid).remove();
    }

    async listAuthorizedApps() {
        return await this.client.authorizedConnectApps.list();
    }

    async listConnectApps() {
        return await this.client.connectApps.list();
    }
    // OUTGOING CALLER IDS
    async listOutgoingCallerIds() {
        return await this.client.outgoingCallerIds.list();
    }

    // RECORDINGS
    async listRecordings() {
        return await this.client.recordings.list({ limit: 10 });
    }

    // TRANSCRIPTIONS
    async listTranscriptions() {
        return await this.client.transcriptions.list({ limit: 10 });
    }

    // ADDRESSES
    async listAddresses() {
        return await this.client.addresses.list();
    }

    // APPLICATIONS
    async listApplications() {
        return await this.client.applications.list();
    }

    // SHORT CODES
    async listShortCodes() {
        return await this.client.shortCodes.list();
    }

    // NOTIFICATIONS (errors/warnings)
    async listNotifications() {
        return await this.client.notifications.list({ limit: 10 });
    }

    // KEYS
    async listApiKeys() {
        return await this.client.keys.list();
    }

    // SIGNING KEYS
    async listSigningKeys() {
        return await this.client.signingKeys.list();
    }

    // SIP DOMAINS
    async listSipDomains() {
        return await this.client.sip.domains.list();
    }

    // SIP IP Access Control Lists
    async listSipIpAccessLists() {
        return await this.client.sip.ipAccessControlLists.list();
    }

    // SIP Credential Lists
    async listSipCredentialLists() {
        return await this.client.sip.credentialLists.list();
    }
}