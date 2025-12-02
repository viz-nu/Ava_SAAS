import axios from "axios";

export class TataTeleService {
    constructor(apiKey, apiToken, domain = "https://api-smartflo.tatateleservices.com") {
        this.apiKey = apiKey;
        this.apiToken = apiToken;
        this.domain = domain;
    }
    async refreshToken() {
        try {
            const { data } = await axios.post(`${this.domain}/v1/auth/refresh`, { headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            this.apiToken = data.access_token;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to refresh token: ${message}`);
        }
    }
    async existingPhoneNumbers() {
        try {
            const { data } = await axios.get(`${this.domain}/v1/my_number`, { headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get existing phone numbers: ${message}`);
        }
    }
    async updatePhoneNumber(phoneNumber, options = {}) {
        try {
            const Phones = await this.existingPhoneNumbers()
            const Phone = Phones.find(number => number.did === phoneNumber);
            if (!Phone?.id) throw new Error(`Phone number not found: ${phoneNumber}`);
            const { data } = await axios.put(`${this.domain}/v1/my_number/${Phone.id}`, options, { headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to update phone number: ${JSON.stringify(message)}`);
        }
    }
    async outboundCallToFlow({ number, CallerId, customField }) {
        try {
            const { data } = await axios.post(`${this.domain}/v1/click_to_call_support`, {
                customer_number: number,
                caller_id: CallerId,
                async: 1,
                api_key: this.apiKey,
                ...customField,
                tsp: "tataTele"
            }, { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to outbound call to flow: ${JSON.stringify(message)}`);
        }
    }
    async getCallDetails(filters = {}) {
        try {
            // send filters as query params
            const { data } = await axios.get(`${this.domain}/v1/call/records`, { params: filters, headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get call details: ${message}`);
        }
    }
    async activeCalls(filters = {}) {
        try {
            const { data } = await axios.get(`${this.domain}/v1/live_calls`, { params: filters, headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get active calls: ${message}`);
        }
    }
}