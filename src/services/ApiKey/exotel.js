import axios from "axios";

const SUBDOMAIN_MAP = {
    singapore: "api.exotel.com",       // my.exotel.com accounts
    mumbai: "api.in.exotel.com",       // my.mum1.exotel.com accounts
};

function buildBaseUrl(subdomain) {
    return `https://${subdomain}`;
}

function basicAuth(apiKey, apiToken) {
    return `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`;
}

export default {
    name: "exotel",

    getConfig() {
        return {};
    },

    // Exotel has no OAuth — credentials are static (apiKey + apiToken + accountSid + subdomain).
    // getAuthUrl is not applicable; the UI should collect these four fields directly.
    getAuthUrl() {
        return { AuthUrl: null, note: "Exotel uses static API credentials, not OAuth. Collect apiKey, apiToken, accountSid, and region from the user." };
    },

    // Validates the credentials by hitting a lightweight Exotel endpoint.
    // ExpectedKeysFromQuery: ['apiKey', 'apiToken', 'accountSid', 'region']
    // region: 'singapore' | 'mumbai'  (defaults to 'singapore')
    async getTokens({ apiKey, apiToken, accountSid, region = "singapore" }) {
        if (!apiKey || !apiToken || !accountSid) {
            return { success: false, tokenError: { code: "missing_credentials", message: "apiKey, apiToken, and accountSid are required.", status: 400 } };
        }
        const subdomain = SUBDOMAIN_MAP[region] || SUBDOMAIN_MAP.singapore;
        try {
            // Lightweight validation: list calls (empty is fine, 200 = credentials valid)
            const { data: accountDetails } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return {
                success: true,
                credentials: { apiKey, apiToken, accountSid, subdomain },
                accountDetails,
                config: {},
                scope: [],
            };
        } catch (error) {
            return { success: false, tokenError: this._handleExotelError(error) };
        }
    },

    // Sets up inbound call/SMS webhook for the given Exotel virtual number (exophone).
    // config must include: { exophone }  — the DID/Exophone to attach the webhook to
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`;
        const { apiKey, apiToken, accountSid, subdomain } = apiAuthenticator.credentials;
        const { exophone } = config;

        if (!exophone) return { success: false, error: { code: "missing_exophone", message: "config.exophone (DID number) is required.", status: 400 } };

        try {
            // Exotel doesn't have a single "register webhook" REST endpoint.
            // Webhooks are configured per-call via StatusCallback in the call API,
            // OR globally per Exophone via the integrations app_setting API.
            // We register the popup/callback URL via the integrations core endpoint.
            const integrationsBase = `https://integrationscore.mum1.exotel.com/v2/integrations`;
            const authCode = basicAuth(apiKey, apiToken);

            // Set inbound call handler (popup) webhook
            await axios.post(`${integrationsBase}/app_setting`,
                { Key: "popup", Value: webhookUrl },
                { headers: { Authorization: authCode, "Content-Type": "application/json" } }
            );

            // Set post-call status callback
            await axios.post(`${integrationsBase}/app_setting`,
                { Key: "callback", Value: webhookUrl },
                { headers: { Authorization: authCode, "Content-Type": "application/json" } }
            );

            return {
                success: true,
                config: { ...config, webhookUrl, exophone },
                error: null,
            };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async getUserInfo({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) {
            return { success: false, error: { code: "missing_credentials", message: "apiKey, apiToken, and accountSid are required.", status: 400 } };
        }
        try {
            // Fetch account-level info via the Calls list (lightest endpoint that confirms identity)
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return { success: true, data: { accountSid, subdomain, ...data } };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async getTokenInfo({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) {
            return { success: false, error: { code: "missing_credentials", message: "apiKey, apiToken, and accountSid are required.", status: 400 } };
        }
        try {
            await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return {
                success: true,
                data: {
                    clientId: accountSid,
                    scopes: [],
                    expiresIn: null,     // Exotel credentials never expire
                    isValid: true,
                },
            };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async validateToken({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) return false;
        try {
            await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return true;
        } catch {
            return false;
        }
    },

    /** ----------------------------
     *  Voice — Outbound Calls
     * -----------------------------*/

    async makeCall({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore, from, to, callFlowUrl, statusCallback }) {
        try {
            const params = new URLSearchParams({ From: from, To: to, Url: callFlowUrl });
            if (statusCallback) params.append("StatusCallback", statusCallback);
            const { data } = await axios.post(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls/connect.json`,
                params,
                { headers: { Authorization: basicAuth(apiKey, apiToken), "Content-Type": "application/x-www-form-urlencoded" } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async getCallDetails({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore, callSid }) {
        try {
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls/${callSid}.json`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async listCalls({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore, filters = {} }) {
        try {
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json`,
                { params: filters, headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    /** ----------------------------
     *  SMS
     * -----------------------------*/

    async sendSms({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore, from, to, body, dltEntityId, dltTemplateId, statusCallback }) {
        try {
            const params = new URLSearchParams({ From: from, To: to, Body: body });
            // DLT fields are mandatory for India (TRAI regulation)
            if (dltEntityId) params.append("DltEntityId", dltEntityId);
            if (dltTemplateId) params.append("DltTemplateId", dltTemplateId);
            if (statusCallback) params.append("StatusCallback", statusCallback);
            const { data } = await axios.post(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Sms/send.json`,
                params,
                { headers: { Authorization: basicAuth(apiKey, apiToken), "Content-Type": "application/x-www-form-urlencoded" } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    async getSmsDetails({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore, smsSid }) {
        try {
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/SMS/Messages/${smsSid}.json`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    /** ----------------------------
     *  Virtual Numbers (Exophones)
     * -----------------------------*/

    async listExophones({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        try {
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleExotelError(error) };
        }
    },

    _handleExotelError(error) {
        const response = error.response;
        const exotelMsg = response?.data?.RestException?.Message || response?.data?.message;
        switch (response?.status) {
            case 400: return { code: "invalid_request", message: exotelMsg || "Bad request.", status: 400 };
            case 401: return { code: "invalid_credentials", message: "Authentication failed. Check your API key and token.", status: 401 };
            case 404: return { code: "not_found", message: exotelMsg || "Account SID incorrect or wrong regional endpoint.", status: 404 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests. Exotel limit: 200 req/min.", status: 429 };
            default: {
                console.error(error?.response?.data);
                return { code: "provider_error", message: "Unable to reach Exotel servers.", status: response?.status || 503 };
            }
        }
    },
};