import axios from "axios";

export class TataTeleService {
    constructor(apiKey, apiToken) {
        this.apiKey = apiKey;
        this.apiToken = apiToken;
    }
    async refreshToken() {
        try {
            const { data } = await axios.post(`https://api-smartflo.tatateleservices.com/v1/auth/refresh`, { headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            this.apiToken = data.access_token;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to refresh token: ${message}`);
        }
    }
    async existingPhoneNumbers() {
        try {
            const { data } = await axios.get(`https://api-smartflo.tatateleservices.com/v1/my_number`, { headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get existing phone numbers: ${message}`);
        }
    }
    async outboundCallToFlow({ number, customField }) {
        try {
            const { data } = await axios.post(`https://api-smartflo.tatateleservices.com/v1/click_to_call_support`, {
                customer_number: number,
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
            const { data } = await axios.get(`https://api-smartflo.tatateleservices.com/v1/call/records`, { params: filters, headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get call details: ${message}`);
        }
    }
    async activeCalls(filters = {}) {
        try {
            const { data } = await axios.get(`https://api-smartflo.tatateleservices.com/v1/live_calls`, { params: filters, headers: { 'Authorization': this.apiToken, 'Accept': 'application/json', 'Content-Type': 'application/json' } });
            return data;
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data || error.message || "Unknown error";
            throw new Error(`Failed to get active calls: ${message}`);
        }
    }
}