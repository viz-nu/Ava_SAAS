import axios from "axios";
const { TWILIO_AUTH_TOKEN, TWILIO_CONNECT_APP_SID, TWILIO_REDIRECT_URI } = process.env;
import twilio from 'twilio';

// Twilio uses Basic Auth (AccountSid:AuthToken) rather than OAuth2.
// There is no auth URL or token exchange flow — credentials are static
// and issued directly from the Twilio Console. This provider validates,
// normalises, and wraps those credentials in the same interface shape
// as OAuth providers so the rest of the system can treat them uniformly.

const BASE_URL = "https://api.twilio.com/2010-04-01";

function buildBasicToken(accountSid, authToken) {
    return Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

async function getTwilioClient(AccountSid) {
    return twilio(AccountSid, TWILIO_AUTH_TOKEN);
}
export default {
    name: "twilio",
    getConfig() {
        return { authToken: TWILIO_AUTH_TOKEN, };
    },
    getAuthUrl({ state = "" } = {}) {
        const params = new URLSearchParams({ redirectTo: TWILIO_REDIRECT_URI, ...(state && { state }), });
        return { ExpectedKeysFromQuery: ['AccountSid'], AuthUrl: `https://www.twilio.com/authorize/${TWILIO_CONNECT_APP_SID}?${params}` }
    },
    async getTokens({ AccountSid }) {
        if (!AccountSid) return { success: false, tokenError: { code: "missing_account_sid", message: "accountSid is required.", status: 400 } };
        try {
            const { data: accountDetails } = await axios.get(`${BASE_URL}/Accounts/${AccountSid}.json`, { headers: { Authorization: `Basic ${buildBasicToken(AccountSid, TWILIO_AUTH_TOKEN)}` } });
            return { success: true, credentials: { id: AccountSid, basicToken: buildBasicToken(AccountSid, TWILIO_AUTH_TOKEN) }, scope: [], accountDetails, config: this.getConfig() };
        } catch (error) {
            return { success: false, tokenError: this._handleTwilioError(error) };
        }
    },
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        let smswebhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`
        let voicewebhookUrl = `${process.env.VoiceCallWebhookUrl}/twilio-redirect/${channelId}`
        const { PhoneNumberSid } = config
        const { id: AccountSid } = apiAuthenticator.credentials;
        try {
            const client = twilio(AccountSid, TWILIO_AUTH_TOKEN);
            const inboundPhoneNumber = await client.updatePhoneNumber(PhoneNumberSid, {
                voiceUrl: voicewebhookUrl,
                smsUrl: smswebhookUrl,
            })
            return { success: true, config: { ...config, ...inboundPhoneNumber }, error: null }
        } catch (error) {
            return { success: false, error: this._handleTwilioError(error) };
        }
    },
    async getUserInfo({ basicToken }) {
        if (!basicToken || typeof basicToken !== "string") return { success: false, error: { code: "missing_token", message: "A basicToken string is required.", status: 400 } };
        try {
            // Decode the SID from the basic token so we can hit the right account endpoint.
            const decoded = Buffer.from(basicToken, "base64").toString("utf8");
            const accountSid = decoded.split(":")[0];

            const { data } = await axios.get(`${BASE_URL}/Accounts/${accountSid}.json`, {
                headers: { Authorization: `Basic ${basicToken}` },
            });
            if (!data) return { success: false, error: { code: "malformed_response", message: "Invalid response from Twilio.", status: 502 } };
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTwilioError(error) };
        }
    },
    async getTokenInfo({ basicToken }) {
        if (!basicToken || typeof basicToken !== "string") return { success: false, error: { code: "missing_token", message: "A basicToken string is required.", status: 400 } };
        try {
            const decoded = Buffer.from(basicToken, "base64").toString("utf8");
            const accountSid = decoded.split(":")[0];

            const { data } = await axios.get(`${BASE_URL}/Accounts/${accountSid}.json`, {
                headers: { Authorization: `Basic ${basicToken}` },
            });
            console.log("tokeninfo:", data);
            if (!data) return { success: false, error: { code: "malformed_response", message: "Invalid response from Twilio.", status: 502 } };
            return {
                success: true,
                data: {
                    clientId: data.sid,
                    scopes: [],          // Twilio uses sub-accounts and API keys, not scopes
                    expiresIn: null,     // Credentials never expire
                    isValid: data.status === "active",
                },
            };
        } catch (error) {
            return { success: false, error: this._handleTwilioError(error) };
        }
    },
    async validateToken({ basicToken }) {
        if (!basicToken || typeof basicToken !== "string") return false;
        try {
            const decoded = Buffer.from(basicToken, "base64").toString("utf8");
            const accountSid = decoded.split(":")[0];
            await axios.get(`${BASE_URL}/Accounts/${accountSid}.json`, { headers: { Authorization: `Basic ${basicToken}` } });
            return true;
        } catch (error) {
            return false;
        }
    },


    /** ----------------------------
     *  Phone Numbers
     * -----------------------------*/

    async listAvailableNumbersWithPricing({ accountSid, country = 'US', type = ['local'], options }) {
        const client = getTwilioClient(accountSid);
        let pricing = {};
        const types = Array.isArray(type) ? type : [type];
        try {
            const priceResp = await client.pricing.v1.phoneNumbers.countries(country).fetch();
            const typePrices = {};
            priceResp.phoneNumberPrices?.forEach(p => {
                if (types.includes(p.number_type)) typePrices[p.number_type] = { basePrice: p.base_price, currentPrice: p.current_price };
                else if (p.number_type === "toll free" && types.includes("tollFree")) typePrices["tollFree"] = { basePrice: p.base_price, currentPrice: p.current_price };
            });
            pricing = {
                currency: priceResp.priceUnit,
                types: typePrices
            };
        } catch (e) {
            console.warn('Could not fetch pricing:', e.message);
        }
        let numbers = await Promise.all(types.map(async (t) => {
            try {
                let list = await client.availablePhoneNumbers(country)[t].list(options);
                list = list.map(ele => ({ ...ele, cost: { currency: pricing.currency, ...pricing.types[t] } }));
                return list;
            } catch (e) {
                console.warn(`Could not fetch ${t} numbers:`, e.message);
                return [];
            }
        }));
        return numbers.flat();
    },
    async buyPhoneNumber({ accountSid, phoneNumber, friendlyName, smsUrl, voiceUrl }) {
        const client = getTwilioClient(accountSid);
        return await client.incomingPhoneNumbers.create({ phoneNumber, friendlyName, smsUrl, voiceUrl });
    },
    async listOwnedPhoneNumbers({ accountSid, limit = 20 }) {
        const client = getTwilioClient(accountSid);
        const ownedNumbers = await client.incomingPhoneNumbers.list({ limit });
        console.log(JSON.stringify(ownedNumbers, null, 2));
        return ownedNumbers;
    },
    async updatePhoneNumber({ accountSid, sid, params }) {
        const client = getTwilioClient(accountSid);
        return await client.incomingPhoneNumbers(sid).update(params);
    },
    async releasePhoneNumber({ accountSid, sid }) {
        const client = getTwilioClient(accountSid);
        return await client.incomingPhoneNumbers(sid).remove();
    },

    /** ----------------------------
     *  Account Details
     * -----------------------------*/

    async getAccountDetails({ accountSid }) {
        const client = getTwilioClient(accountSid);
        return client.api.accounts(accountSid).fetch();
    },

    /** ----------------------------
     *  Recordings
     * -----------------------------*/

    async getRecording({ accountSid, options }) {
        const client = getTwilioClient(accountSid);
        return client.recordings.list(options);
    },

    /** ----------------------------
        *  Voice: Outbound & Inbound Calls
        * -----------------------------*/

    async makeOutboundCall({ accountSid, to, from }) {
        const client = getTwilioClient(accountSid);
        if (!to || !from) throw new Error("Both 'to' and 'from' numbers are required.");
        let payload = { to, from, timeout: 60, machineDetection: "Enable", machineDetectionTimeout: 30, trim: "trim-silence", record: true, transcribe: true, recordingChannels: "dual" };
        payload.url = "https://demo.twilio.com/docs/voice.xml";
        payload.method = "POST";
        const call = await client.calls.create(payload);
        return call.toJSON ? call.toJSON() : call;
    },
    async makeAIOutboundCall({ accountSid, to, from, url, webhookUrl, conversationId, model }) {
        try {
            const client = getTwilioClient(accountSid);
            const VoiceResponse = twilio.twiml.VoiceResponse;
            const response = new VoiceResponse();
            const connect = response.connect();
            const stream = connect.stream({ url });
            stream.parameter({ name: 'conversationId', value: conversationId });
            stream.parameter({ name: 'tsp', value: "twilio" });
            stream.parameter({ name: 'model', value: model });
            const twiml = response.toString();
            return await client.calls.create({ to, from, twiml, record: true, statusCallback: webhookUrl, statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'], statusCallbackMethod: 'POST' });
        } catch (error) {
            console.error("Error making Twilio AI outbound call:", error);
            throw new Error("Error making Twilio AI outbound call");
        }
    },
    async listCalls({ accountSid, options }) {
        const client = getTwilioClient(accountSid);
        return await client.calls.list(options);
    },
    async endCall({ accountSid, callSid }) {
        const client = getTwilioClient(accountSid);
        return await client.calls(callSid).update({ status: 'completed' });
    },

    /** ----------------------------
     *  SMS Messaging
     * -----------------------------*/

    async sendSms({ accountSid, to, from, body, mediaUrl = [], statusCallback }) {
        const client = getTwilioClient(accountSid);
        return await client.messages.create({ to, from, body, mediaUrl, statusCallback });
    },
    async SmsStatus({ accountSid, sid }) {
        const client = getTwilioClient(accountSid);
        return await client.messages(sid).fetch();
    },
    async listMessages({ accountSid, limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize }) {
        const client = getTwilioClient(accountSid);
        return await client.messages.list({ limit, to, from, dateSent, dateSentBefore, dateSentAfter, pageSize });
    },

    /** ----------------------------
     *  Usage
     * -----------------------------*/

    async fetchUsageRecords({ accountSid, options }) {
        const client = getTwilioClient(accountSid);
        return client.usage.records.list(options);
    },
    async getTwilioUsageRecordsTimely({ accountSid, limit = 10, Instance = "allTime", year }) {
        const client = getTwilioClient(accountSid);
        if (Instance == "yearly") return await client.usage.records[Instance].list({ limit, year });
        return await client.usage.records[Instance].list({ limit });
    },

    /** ----------------------------
     *  Pricing
     * -----------------------------*/

    async getPricing({ accountSid, country, twilioService }) {
        const client = getTwilioClient(accountSid);
        return await client.pricing.v1[twilioService].countries(country).fetch();
    },

    /** ----------------------------
     *  Transcriptions
     * -----------------------------*/

    async listTranscriptions({ accountSid, options }) {
        const client = getTwilioClient(accountSid);
        return client.transcriptions.list(options);
    },

    _handleTwilioError(error) {
        const response = error.response;
        const twilioCode = response?.data?.code;
        const twilioMessage = response?.data?.message;
        switch (response?.status) {
            case 400: return { code: twilioCode || "invalid_request", message: twilioMessage || "Bad request.", status: 400 };
            case 401: return { code: "invalid_credentials", message: "The AccountSid or AuthToken provided is incorrect.", status: 401 };
            case 403: return { code: "permission_denied", message: twilioMessage || "Your account does not have permission to perform this action.", status: 403 };
            case 404: return { code: "not_found", message: twilioMessage || "The requested resource does not exist.", status: 404 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Twilio servers.", status: 429 };
            default: {
                console.error(error.response.data);
                return { code: "provider_error", message: "Unable to reach Twilio servers.", status: response?.status || 503 };
            }
        }
    },
};