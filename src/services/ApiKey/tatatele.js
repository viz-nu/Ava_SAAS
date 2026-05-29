import axios from "axios";

// Smartflo / Tata Tele Business Services — CPaaS provider
// Auth: Bearer token generated from the Smartflo portal (API Connect → API Tokens).
// Portal-generated tokens never expire. API-generated tokens expire in 60 min.
// Base URL: https://api-smartflo.tatateleservices.com

const BASE_URL = "https://api-smartflo.tatateleservices.com";

function authHeaders(apiToken) {
    return { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", accept: "application/json" };
}

export default {
    name: "tatatele",

    getConfig() {
        return {};
    },

    // Smartflo does not use OAuth. Tokens are manually generated in the Smartflo portal.
    // The UI should collect: apiToken (the bearer token from API Connect → API Tokens).
    getAuthUrl() {
        return { AuthUrl: null, note: "Smartflo uses a static Bearer API token, not OAuth. The user must generate a token in their Smartflo portal under API Connect → API Tokens." };
    },

    // Validates the static bearer token by fetching live/active calls (lightweight endpoint).
    // ExpectedKeysFromQuery: ['apiToken']
    async getTokens({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") {
            return { success: false, tokenError: { code: "missing_apiToken", message: "apiToken is required.", status: 400 } };
        }
        try {
            const { data: accountDetails } = await axios.get(`${BASE_URL}/v1/live_calls`, {
                headers: authHeaders(apiToken),
            });
            return {
                success: true,
                credentials: { apiToken },
                accountDetails,
                config: {},
                scope: [],
            };
        } catch (error) {
            return { success: false, tokenError: this._handleTataTeleError(error) };
        }
    },

    // Registers the inbound webhook for the given DID number (pilot number).
    // Smartflo webhooks are configured via the portal (API Connect → Webhook), but this
    // method calls the webhook management REST endpoint where available.
    // config must include: { didNumber } — the pilot/DID number to receive inbound calls
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`;
        const { apiToken } = apiAuthenticator.credentials;
        const { didNumber } = config;

        if (!didNumber) return { success: false, error: { code: "missing_didNumber", message: "config.didNumber (pilot number) is required.", status: 400 } };

        try {
            // Smartflo webhooks are primarily configured through the portal.
            // However, the broadcast and call APIs accept a per-request statusCallback.
            // For programmatic webhook registration we register via the CDR/webhook endpoint.
            // NOTE: Contact TTBS support (SR) to enable webhook API for your account.
            await axios.post(`${BASE_URL}/v1/webhook`, {
                name: `Channel_${channelId}`,
                url: webhookUrl,
                trigger: "Call hangup (Missed or Answered)",
                request: "POST",
                call_type: "Inbound",
                content_type: "application/json",
                my_numbers: [didNumber],
            }, { headers: authHeaders(apiToken) });

            return {
                success: true,
                config: { ...config, webhookUrl, didNumber },
                error: null,
            };
        } catch (error) {
            // Webhook API may not be enabled — return success with manual setup note
            const err = this._handleTataTeleError(error);
            console.warn("Smartflo webhook registration failed (may require SR to enable):", err);
            return {
                success: true,
                config: { ...config, webhookUrl, didNumber },
                warning: "Automatic webhook registration is not available for this account. Configure manually in Smartflo portal: API Connect → Webhook.",
            };
        }
    },

    async getUserInfo({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "apiToken is required.", status: 400 } };
        }
        try {
            // /v1/live_calls is the lightest authenticated endpoint available
            const { data } = await axios.get(`${BASE_URL}/v1/live_calls`, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async getTokenInfo({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "apiToken is required.", status: 400 } };
        }
        try {
            await axios.get(`${BASE_URL}/v1/live_calls`, { headers: authHeaders(apiToken) });
            return {
                success: true,
                data: {
                    clientId: null,       // Smartflo tokens are not scoped to a machine ID
                    scopes: [],
                    expiresIn: null,      // Portal tokens never expire; API tokens expire in 60 min
                    isValid: true,
                },
            };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async validateToken({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") return false;
        try {
            await axios.get(`${BASE_URL}/v1/live_calls`, { headers: authHeaders(apiToken) });
            return true;
        } catch {
            return false;
        }
    },

    /** ----------------------------
     *  Calls
     * -----------------------------*/

    // Click-to-call: dials the customer first, then connects to the agent/destination
    async clickToCall({ apiToken, from, to, statusCallback }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/v1/call/click_to_call`, {
                from, to, ...(statusCallback && { status_callback: statusCallback }),
            }, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async getActiveCalls({ apiToken }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/v1/live_calls`, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async getCallOptions({ apiToken, callSid, action }) {
        // action: 'monitor' | 'whisper' | 'barge' | 'hold' | 'unhold'
        try {
            const { data } = await axios.post(`${BASE_URL}/v1/call/options`, { call_sid: callSid, action }, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async getScheduledCalls({ apiToken }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/v1/schedule_calls`, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    /** ----------------------------
     *  Call Detail Records (CDR)
     * -----------------------------*/

    async getCallLogs({ apiToken, filters = {} }) {
        // filters: { start_date, end_date, call_type, page, per_page }
        try {
            const { data } = await axios.get(`${BASE_URL}/v1/cdr`, { params: filters, headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    /** ----------------------------
     *  Broadcast (Voice campaigns)
     * -----------------------------*/

    async createBroadcast({ apiToken, payload }) {
        // payload: { name, caller_id, lists, campaign_type, flow_type, read_via_text, ... }
        try {
            const { data } = await axios.post(`${BASE_URL}/v1/broadcast`, payload, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async getBroadcastDetails({ apiToken, broadcastId }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/v1/broadcast/${broadcastId}`, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    /** ----------------------------
     *  IVR
     * -----------------------------*/

    async listIVRs({ apiToken }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/v1/ivr`, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async createIVR({ apiToken, payload }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/v1/ivr`, payload, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    async updateIVR({ apiToken, ivrId, payload }) {
        try {
            const { data } = await axios.put(`${BASE_URL}/v1/ivr/${ivrId}`, payload, { headers: authHeaders(apiToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleTataTeleError(error) };
        }
    },

    _handleTataTeleError(error) {
        const response = error.response;
        const msg = response?.data?.message || response?.data?.error;
        switch (response?.status) {
            case 400: return { code: "invalid_request", message: msg || "Bad request.", status: 400 };
            case 401: return { code: "invalid_token", message: "The API token is invalid or has expired.", status: 401 };
            case 403: return { code: "permission_denied", message: msg || "Token lacks required scope or IP is not whitelisted.", status: 403 };
            case 404: return { code: "not_found", message: msg || "Resource not found.", status: 404 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Smartflo.", status: 429 };
            default: {
                console.error(error?.response?.data);
                return { code: "provider_error", message: "Unable to reach Smartflo servers.", status: response?.status || 503 };
            }
        }
    },
};