import axios from "axios";

export default {
    name: "google",
    getScopes(scopeCategory) {
        const base = ["openid", "profile", "email"];
        switch (scopeCategory) {
            case "gmail.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/gmail.readonly",
                ];

            case "gmail.send":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/gmail.send",
                ];

            case "gmail.full":
                return [
                    ...base,
                    "https://mail.google.com/", // full access (be careful ⚠️)
                ];

            case "drive.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive.readonly",
                ];

            case "drive.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive.file", // recommended minimal write
                ];

            case "drive.full":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive",
                ];

            case "sheets.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets.readonly",
                ];

            case "sheets.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets",
                ];

            case "calendar.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar.readonly",
                ];

            case "calendar.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar.events",
                ];

            case "calendar.full":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar",
                ];

            case "forms.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/forms.responses.readonly",
                ];

            case "forms.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/forms.body",
                ];

            default:
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets",
                ];
        }
    },
    getAuthUrl({ state, scopeCategory }) {
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            response_type: "code",
            scope: this.getScopes(scopeCategory).join(" "),
            access_type: "offline",
            prompt: "consent",
            state,
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async getTokens(code) {
        if (!code || typeof code !== 'string') return { success: false, error: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const { data } = await axios.post("https://oauth2.googleapis.com/token", {
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code",
            });
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async refreshToken(refreshToken) {
        if (!refreshToken || typeof refreshToken !== 'string') return { success: false, error: { code: "missing_token", message: "A refresh token string is required.", status: 400 } };
        try {
            const { data } = await axios.post("https://oauth2.googleapis.com/token", {
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: "refresh_token",
            });
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async getUserInfo(accessToken) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://www.googleapis.com/oauth2/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, });
            if (!data || !data.azp) return { success: false, error: { code: "malformed_response", message: "Invalid response from Google.", status: 502 } };
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async getTokenInfo(accessToken) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo`, { params: { access_token: accessToken }, timeout: 5000, });
            if (!data || !data.azp) return { success: false, error: { code: "malformed_response", message: "Invalid response from Google.", status: 502 } };
            return { success: true, data: { clientId: data.azp, scopes: data.scope?.split(" ") || [], expiresIn: parseInt(data.expires_in), email: data.email, isValid: true } };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async validateToken(accessToken) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo`, { params: { access_token: accessToken }, timeout: 5000, });
            return true;
        } catch (error) {
            return false;
        }
    },
    /**
     * Internal helper to categorize errors
     */
    _handleGoogleError(error) {
        const response = error.response;
        switch (response?.status) {
            case 400: return { code: response.data?.error || "invalid_token", message: response.data?.error_description || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Google validation servers.", status: 429 };
            default: return { code: "provider_error", message: "Unable to reach Google authentication servers.", status: response?.status || 503 };
        }
    }
};