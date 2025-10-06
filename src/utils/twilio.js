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
    async updatePhoneNumber(sid, params) {
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

    async makeOutboundCall({ to, from }) {
        if (!to || !from) throw new Error("Both 'to' and 'from' numbers are required.");
        let payload = { to, from, timeout: 60, machineDetection: "Enable", machineDetectionTimeout: 30, trim: "trim-silence", record: true, transcribe: true, recordingChannels: "dual" };
        payload.url = "https://demo.twilio.com/docs/voice.xml";
        payload.method = "POST";
        const call = await this.client.calls.create(payload);
        return call.toJSON ? call.toJSON() : call;
    }
    async makeAIOutboundCall({ to, from, url, webhookUrl, agentId, conversationId, model }) {
        try {
            const VoiceResponse = twilio.twiml.VoiceResponse;
            const response = new VoiceResponse();
            const connect = response.connect();
            const stream = connect.stream({ url });
            stream.parameter({ name: 'conversationId', value: conversationId });
            stream.parameter({ name: 'agentId', value: agentId });
            stream.parameter({ name: 'model', value: model });
            const twiml = response.toString();
            // console.log("ready to make call", { conversationId, agentId, model });
            return await this.client.calls.create({ to, from, twiml, record: true, statusCallback: webhookUrl, statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'], statusCallbackMethod: 'POST' });
        } catch (error) {
            console.error("Error making Twilio AI outbound call:", error);
            throw new Error("Error making Twilio AI outbound call");
        }
    }
    async listCalls(options) {
        return await this.client.calls.list(options);
    }
    async endCall(callSid) {
        return await this.client.calls(callSid).update({ status: 'completed' });
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
    // async deauthorizeConnectApp(connectAppSid) {
    //     return await this.client.authorizedConnectApps(connectAppSid).remove();
    // } // doesnt work

    // TRANSCRIPTIONS
    async listTranscriptions(options) {
        return await this.client.transcriptions.list(options);
    }

}