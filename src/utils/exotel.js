import axios from "axios";

export class ExotelService {
    constructor(apiKey, apiToken, accountSid, subdomain, region) {
        this.apiKey = apiKey;
        this.apiToken = apiToken;
        this.accountSid = accountSid;
        this.subdomain = "@" + subdomain;
        this.region = region;
    }
    async getAccountDetails() {
        try {
            const { data } = await axios.get(`https://api.exotel.com/v1/Accounts/${this.accountSid}.json`, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`
                }
            });
            // expect 
            // { Sid: 'onewindowoverseaseducation1', FriendlyName: 'One Window Overseas Education', Type: 'Full', Status: 'active', DateCreated: '2025-05-16 17:27:41', DateUpdated: '2025-11-07 15:20:11', AuthToken: '527fd13190fd4508b6d1bacd762f22b3938dca16', Uri: null, BillingType: 'prepaid', KycStatus: 'completed' }
            return data.Account;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get account details: ${message}`);
        }

    }
    async existingPhoneNumbers(exophone_sid = "") {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers${exophone_sid ? `/${exophone_sid}` : ''}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get existing phone numbers: ${message}`);
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
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/AvailablePhoneNumbers/${country}/${type}?${Object.entries(options).map(([key, value]) => `${key}=${value}`).join('&')}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get available exo phones: ${message}`);
        }
    }
    async buyPhoneNumber(phoneNumber, options = { VoiceUrl: "", SmsUrl: "", friendlyName: "" }) {
        const body = new URLSearchParams({
            PhoneNumber: phoneNumber,
            ...options,
        });

        try {
            const { data } = await axios.post(`
            https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to buy phone number: ${message}`);
        }
    }
    async assignPhoneNumberToFlow(exophone_sid, options = {}) { // for inbound calls
        const body = new URLSearchParams({
            ...options,
        });
        try {
            const { data } = await axios.put(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}.json`,
                body,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to assign phone number to flow: ${message}`);
        }
    }
    async deletePhoneNumber(exophone_sid) {
        try {
            const { data } = await axios.delete(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v2_beta/Accounts/${this.accountSid}/IncomingPhoneNumbers/${exophone_sid}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to delete phone number: ${message}`);
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
            const { data } = await axios.post(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/connect.json`, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
            return data.Call;   // { Sid: 'f162cf479cce037eab49dd5d4fda19ba', ParentCallSid: null, DateCreated: '2025-11-10 16:56:32', DateUpdated: '2025-11-10 16:56:32', AccountSid: 'onewindowoverseaseducation1', To: '04045210835', From: '09959964639', PhoneNumberSid: '04045210835', Status: 'in-progress', StartTime: '2025-11-10 16:56:32', EndTime: null, Duration: null, Price: null, Direction: 'outbound-api', AnsweredBy: null, ForwardedFrom: null, CallerName: null, Uri: '/v1/Accounts/onewindowoverseaseducation1/Calls/f162cf479cce037eab49dd5d4fda19ba.json', RecordingUrl: null }
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to outbound call to flow: ${message}`);
        }
    }
    /**
 * Get call details with optimized filters.
 *
 * @param {Object} filters
 *  - sids: string | string[]
 *  - dateFrom: 'YYYY-MM-DD HH:mm:ss'
 *  - dateTo: 'YYYY-MM-DD HH:mm:ss'
 *  - to: string | string[]
 *  - from: string | string[]
 *  - status: string | string[]
 *  - direction: string | string[]
 *  - phoneNumbers: string | string[]
 *  - minDuration: number (seconds)
 *  - maxDuration: number (seconds)
 *  - minPrice: number
 *  - maxPrice: number
 *  - pageSize: number (max 100)
 *  - sortBy: 'DateCreated:asc' | 'DateCreated:desc'
 *  - before: string
 *  - after: string
 *  - details: boolean
 *  - recordingUrlValidity: number (5–60 minutes)
 */
    async getCallDetails(filters = {}) {
        try {
            const { sids, dateFrom, dateTo, to, from, status, direction, phoneNumbers, minDuration, maxDuration, minPrice, maxPrice, pageSize, sortBy, before, after, details, recordingUrlValidity, } = filters;
            const params = {};
            // Sid (one or multiple)
            if (sids) params.Sid = Array.isArray(sids) ? sids.join(",") : sids;
            // DateCreated (gte:..;lte:..)
            if (dateFrom || dateTo) {
                const parts = [];
                if (dateFrom) parts.push(`gte:${dateFrom}`);
                if (dateTo) parts.push(`lte:${dateTo}`);
                params.DateCreated = parts.join(";"); // AND operator is ';'
            }
            // To / From / PhoneNumber – can be comma separated lists
            if (to) params.To = Array.isArray(to) ? to.join(",") : to;
            if (from) params.From = Array.isArray(from) ? from.join(",") : from;
            if (phoneNumbers) params.PhoneNumber = Array.isArray(phoneNumbers) ? phoneNumbers.join(",") : phoneNumbers;
            // Status – comma-separated OR
            if (status) params.Status = Array.isArray(status) ? status.join(",") : status;
            // Direction – comma-separated OR
            if (direction) params.Direction = Array.isArray(direction) ? direction.join(",") : direction;
            // Duration – with operators gte/lte
            if (minDuration || maxDuration) {
                const parts = [];
                if (minDuration != null) parts.push(`gte:${minDuration}s`);
                if (maxDuration != null) parts.push(`lte:${maxDuration}s`);
                params.Duration = parts.join(";");
            }
            // Price – with operators
            if (minPrice != null || maxPrice != null) {
                const parts = [];
                if (minPrice != null) parts.push(`gte:${minPrice}`);
                if (maxPrice != null) parts.push(`lte:${maxPrice}`);
                params.Price = parts.join(";");
            }
            // Pagination & sorting
            if (pageSize) params.PageSize = pageSize;
            if (sortBy) params.SortBy = sortBy; // e.g. 'DateCreated:asc' or 'DateCreated:desc'
            if (before) params.Before = before;
            if (after) params.After = after;
            // details=true for leg-wise info
            if (details === true) params.details = true;
            // RecordingUrlValidity (5-60 minutes)
            if (recordingUrlValidity) params.RecordingUrlValidity = recordingUrlValidity;
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls.json`, { params });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get call details: ${message}`);
        }
    }
    async getSingleCallDetails(callSid) {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Calls/${callSid}.json`);
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get single call details: ${message}`);
        }
    }
    async NumberLookup(phoneNumber) {
        try {
            const { data } = await axios.get(`https://${this.apiKey}:${this.apiToken}${this.subdomain}/v1/Accounts/${this.accountSid}/Numbers/${phoneNumber}.json`);
            return data;
            // {
            //     "Numbers": {
            //         "PhoneNumber": "0XXXXX30240",
            //             "Circle": "GJ",
            //                 "CircleName": "Gujarat Telecom Circle (includes Daman & Diu, Dadra & Nagar Haveli)",
            //                     "Type": "Mobile", 'Mobile' or 'Landline'
            //                         "Operator": "R",

            // Operator Name	Value
            // AC	Aircel
            // A	Airtel
            // AL	Allianz
            // B	BSNL
            // D	Dishnet
            // E	Etisalat
            // H	HFCL
            // I	Idea
            // LO	Loop
            // MT	MTNL
            // P	Ping
            // R	Reliance
            // S	Sistema
            // ST	S Tel
            // T	Tata
            // U	Unitech
            // VI	Videocon
            // V	Vodafone
            //                             "OperatorName": "Reliance",
            //                                 "DND": "Yes"
            //     }
            // }
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get number lookup: ${message}`);
        }
    }
}