``;
import axios from "axios";

const { TWILIO_AUTH_TOKEN, TWILIO_CONNECT_APP_SID, TWILIO_REDIRECT_URI } = process.env;

// Twilio uses Basic Auth (AccountSid:AuthToken) rather than OAuth2.
// There is no auth URL or token exchange flow — credentials are static
// and issued directly from the Twilio Console. This provider validates,
// normalises, and wraps those credentials in the same interface shape
// as OAuth providers so the rest of the system can treat them uniformly.

const BASE_URL = "https://api.twilio.com/2010-04-01";

function buildBasicToken(accountSid, authToken) {
    return Buffer.from(`${accountSid}:${authToken}`).toString("base64");
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
    // Instead of a code exchange, this accepts the raw Twilio credentials,
    // validates them against the API, and returns them in a normalised shape.
    async getTokens({ accountSid }) {
        if (!accountSid || typeof accountSid !== "string") return { success: false, error: { code: "missing_account_sid", message: "accountSid is required.", status: 400 } };
        try {
            // Validate by fetching the account — if this succeeds the credentials are correct.
            await axios.get(`${BASE_URL}/Accounts/${accountSid}.json`, { headers: { Authorization: `Basic ${buildBasicToken(accountSid, TWILIO_AUTH_TOKEN)}` }, });
            return { success: true, data: { id: accountSid, basicToken: buildBasicToken(accountSid, TWILIO_AUTH_TOKEN) } };
        } catch (error) {
            return { success: false, error: this._handleTwilioError(error) };
        }
    },
    // Twilio credentials do not expire and cannot be refreshed programmatically.
    // This is a no-op that returns the same credentials so the automations
    // engine doesn't need special-case logic for non-expiring providers.
    async refreshToken(basicToken) {
        if (!basicToken || typeof basicToken !== "string") return { success: false, error: { code: "missing_token", message: "A basicToken string is required.", status: 400 } };
        return {
            success: true,
            data: {
                basicToken,
                expiresIn: null,
            },
        };
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
    async getTokenInfo(basicToken) {
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
    async validateToken(basicToken) {
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
            default: return { code: "provider_error", message: "Unable to reach Twilio servers.", status: response?.status || 503 };
        }
    },
};