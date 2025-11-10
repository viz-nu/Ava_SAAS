import axios from "axios";

export class ExotelService {
    constructor(apiKey, apiSecret, accountSid, subdomain) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.accountSid = accountSid;
        this.subdomain = subdomain;
    }
    async getAccountDetails() {
        try {
            const { data } = await axios.get(`https://api.exotel.com/v1/Accounts/${this.accountSid}.json`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`
                }
            });
            // expect 
            // { Sid: 'onewindowoverseaseducation1', FriendlyName: 'One Window Overseas Education', Type: 'Full', Status: 'active', DateCreated: '2025-05-16 17:27:41', DateUpdated: '2025-11-07 15:20:11', AuthToken: '527fd13190fd4508b6d1bacd762f22b3938dca16', Uri: null, BillingType: 'prepaid', KycStatus: 'completed' }
            return data.Account;
        } catch (error) {
            throw new Error(`Failed to get account details: ${error.response.data.message}`);
        }

    }
    async existingPhoneNumbers(exophone_sid = "") {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers${exophone_sid ? `/${exophone_sid}` : ''}`);
            return data;
        } catch (error) {
            throw new Error(`Failed to get existing phone numbers: ${error.response.data.message}`);
        }
    }
    async available_ExoPhones(country = 'IN', type = 'Landline', options = { IncomingSMS: 'No', InRegion: 'AP', Contains: '9494' }) {
        // IncomingSMS => Get only numbers that support incoming SMS.
        // InRegion =>  Get only numbers in the specified telecom circle. This filter is not applicable in all countries. For India, the currently supported regions are:
        // AP - Andhra Pradesh Circle
        // DL - Delhi Circle
        // KA - Karnataka Circle
        // KL - Kerala
        // MH - Maharashtra
        // MP - Madhya Pradesh
        // MU - Mumbai Circle
        // RJ - Rajasthan
        // TN - Tamilnadu
        // WB - West Bengal
        // Contains => Get numbers that contains the specified substring.
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/AvailablePhoneNumbers/${country}/${type}?${Object.entries(options).map(([key, value]) => `${key}=${value}`).join('&')}`);
            return data;
        } catch (error) {
            throw new Error(`Failed to get available exo phones: ${error.response.data.message}`);
        }
    }
    async buyPhoneNumber(phoneNumber, options = { VoiceUrl: "", SmsUrl: "", friendlyName: "" }) {
        const body = new URLSearchParams({
            PhoneNumber: phoneNumber,
            ...options,
        });

        try {
            const { data } = await axios.post(`
            https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            throw new Error(`Failed to buy phone number: ${error.response.data.message}`);
        }
    }
    async assignPhoneNumberToFlow(exophone_sid, options = {}) { // for inbound calls
        const body = new URLSearchParams({
            ...options,
        });
        try {
            const { data } = await axios.put(`https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            throw new Error(`Failed to assign phone number to flow: ${error.response.data.message}`);
        }
    }
    async deletePhoneNumber(exophone_sid) {
        try {
            const { data } = await axios.delete(`https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}`);
            return data;
        } catch (error) {
            throw new Error(`Failed to delete phone number: ${error.response.data.message}`);
        }
    }
    async outboundCallToFlow({ number, CallerId, webhookUrl, conversationId, model, provider, VoiceAppletId }) {
        try {
            //webhookUrl = https://chat.avakado.ai/webhook/exotel/call/status?conversationId=${customField.conversationId}
            const customField = { conversationId, model }
            if (provider == "openai") customField["sample-rate"] = 24000; // anthropic, google, azure, deepgram, elevenlabs,gemini
            const formData = new URLSearchParams();
            formData.append('CallerId', CallerId);
            formData.append('From', number);
            formData.append('Url', `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${VoiceAppletId}`);
            formData.append('StatusCallback', `${webhookUrl}`);
            formData.append('CustomField', JSON.stringify(customField));
            const { data } = await axios.post(`https://${this.apiKey}:${this.apiSecret}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`,
                formData,
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            return data.Call;   // { Sid: 'f162cf479cce037eab49dd5d4fda19ba', ParentCallSid: null, DateCreated: '2025-11-10 16:56:32', DateUpdated: '2025-11-10 16:56:32', AccountSid: 'onewindowoverseaseducation1', To: '04045210835', From: '09959964639', PhoneNumberSid: '04045210835', Status: 'in-progress', StartTime: '2025-11-10 16:56:32', EndTime: null, Duration: null, Price: null, Direction: 'outbound-api', AnsweredBy: null, ForwardedFrom: null, CallerName: null, Uri: '/v1/Accounts/onewindowoverseaseducation1/Calls/f162cf479cce037eab49dd5d4fda19ba.json', RecordingUrl: null }
        } catch (error) {
            console.error(error);
            throw new Error(`Failed to outbound call to flow`);
        }
    }
}