import twilio from 'twilio';
export class TwilioService {
    constructor(userAccountSid, userAuthToken) {
        this.client = twilio(userAccountSid, userAuthToken);
        this.accountSid = userAccountSid;
    }
    /** ----------------------------
  *  Phone Numbers
  * -----------------------------*/
    async listAvailableNumbersWithPricing({ country = 'US', type = ['local'], options }) {

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
        return numbers.flat()
    }

    async buyPhoneNumber(phoneNumber, friendlyName, smsUrl, voiceUrl) {
        return await this.client.incomingPhoneNumbers.create({ phoneNumber, friendlyName, smsUrl, voiceUrl });
    }

    async listOwnedPhoneNumbers(limit = 20) {
        return await this.client.incomingPhoneNumbers.list({ limit });
    }

    async updatePhoneNumber(sid, { friendlyName, voiceUrl, voiceMethod, smsUrl, smsMethod, voiceCallerIdLookup, accountSid }) {
        return await this.client.incomingPhoneNumbers(sid).update(params);
    }
    async releasePhoneNumber(sid) {
        return await this.client.incomingPhoneNumbers(sid).remove();
    }

    /** ----------------------------
  *  Account Details
  * -----------------------------*/
    getAccountDetails() {
        return this.client.api.accounts(this.accountSid).fetch();
    }

    /** ----------------------------
*  Recordings Details
* -----------------------------*/

    getRecording(options) {
        return this.client.recordings.list(options);
    }

    /** ----------------------------
     *  Voice: Outbound & Inbound Calls
     * -----------------------------*/

    async makeOutboundCall({ to, from, url = "https://demo.twilio.com/docs/voice.xml", twiml, statusCallback, statusCallbackEvent = ["initiated", "ringing", "answered", "completed"], statusCallbackMethod = "POST", record = true, timeout = 60, machineDetection = "Enable", machineDetectionTimeout = 30, recordingStatusCallback = null }) {
        if (!to || !from) throw new Error("Both 'to' and 'from' numbers are required.");
        if (twiml && url !== "https://demo.twilio.com/docs/voice.xml") throw new Error("You cannot provide both 'url' and 'twiml'. Choose one.");
        let payload = { to, from, timeout, statusCallback, statusCallbackEvent, statusCallbackMethod, machineDetection, machineDetectionTimeout, trim: "trim-silence", record: record ? "true" : "false", recordingChannels: "dual" };
        if (recordingStatusCallback) {
            payload.recordingStatusCallback = recordingStatusCallback;
            payload.recordingStatusCallbackMethod = "POST";
            payload.recordingStatusCallbackEvent = ["completed"];
        }
        // URL or TwiML
        if (twiml) {
            payload.twiml = twiml;
        } else {
            payload.url = url;
            payload.method = "POST";
        }
        // Create call
        const call = await this.client.calls.create(payload);
        // Return plain JSON for safe persistence/logging
        return call.toJSON ? call.toJSON() : call;
    }
    async makeAIOutboundCall({ to, from, url, agentId, channelId }) {
        const VoiceResponse = new this.client.twiml.VoiceResponse();
        const response = new VoiceResponse();
        const connect = response.connect();
        const stream = connect.stream({ url: url });
        stream.parameter({ name: 'channelId', value: channelId.toString() });
        stream.parameter({ name: 'agentId', value: agentId.toString() });
        const twiml = response.toString();
        await this.client.calls.create({ to, from, twiml, record: true, statusCallback: `https://${process.env.SERVER_URL}webhook/twilio/call/status`, statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'], statusCallbackMethod: 'POST' });
    }
    async listCalls(options) {
        return await this.client.calls.list(options);
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

    async sendSms({ to, from, body, mediaUrl = [], statusCallback }) {
        return await this.client.messages.create({ to, from, body, mediaUrl, statusCallback });
    }
    async SmsStatus(sid) {
        return await this.client.messages(sid).fetch();
    }
    async listMessages({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) {
        return await this.client.messages.list({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
    }

    /** ----------------------------
     *  Usage
     * -----------------------------*/

    async fetchUsageRecords(options) {
        return await this.client.usage.records.list(options);
    }
    async getTwilioUsageRecordsTimely({ limit = 10, Instance = "allTime", year }) {
        if (Instance == "yearly") return await this.client.usage.records[Instance].list({ limit, year });
        return await this.client.usage.records[Instance].list({ limit });
    }
    /** ----------------------------
        *  Pricing
        * -----------------------------*/
    async getPricing(country, twilioService) {
        return await this.client.pricing.v1[twilioService].countries(country).fetch();
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