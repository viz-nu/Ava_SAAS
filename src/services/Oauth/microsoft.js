import axios from "axios";
// ${process.env.AzureApplicationTenantId}
const BASE = `https://login.microsoftonline.com/common/oauth2/v2.0`;

export default {
    name: "microsoft",
    // getScopes(scopeCategory) {
    //     const base = ["openid", "profile", "email", "offline_access", "User.Read"];
    //     switch (scopeCategory) {
    //         case "excel.read": return [...base, "Files.Read",];
    //         case "excel.write": return [...base, "Files.ReadWrite",]; // ✅ recommended
    //         case "excel.full": return [...base, "Files.ReadWrite.All",]; // ⚠️ full tenant access   "Sites.ReadWrite.All",
    //         case "onedrive.read": return [...base, "Files.Read",];
    //         case "onedrive.write": return [...base, "Files.ReadWrite",];
    //         case "onedrive.full": return [...base, "Files.ReadWrite.All",];
    //         case "outlook.read": return [...base, "Mail.Read",];
    //         case "outlook.send": return [...base, "Mail.Send",];
    //         case "calendar.read": return [...base, "Calendars.Read",];
    //         case "calendar.write": return [...base, "Calendars.ReadWrite",];
    //         case "user.basic": return [...base, "User.Read",];
    //         default: return [...base, "Files.ReadWrite",];
    //     }
    // },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: process.env.AzureApplicationClientId, response_type: "code", redirect_uri: process.env.AZURE_REDIRECT_URI, response_mode: "query", scope: scopes.join(" "), state, prompt: "consent" });
        return `${BASE}/authorize?${params}`;
    },
    async getTokens(code) {
        if (!code || typeof code !== 'string') return { success: false, error: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const { data } = await axios.post(`${BASE}/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, code, redirect_uri: process.env.AZURE_REDIRECT_URI, grant_type: "authorization_code", }));
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },

    async refreshToken(refreshToken) {
        if (!refreshToken || typeof refreshToken !== 'string') return { success: false, error: { code: "missing_token", message: "A refresh token string is required.", status: 400 } };
        try {
            const { data } = await axios.post(`${BASE}/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, refresh_token: refreshToken, grant_type: "refresh_token", }));
            return { success: true, data: data };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },
    async getUserInfo(accessToken) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!data || !data.id) return { success: false, error: { code: "malformed_response", message: "Invalid response from Microsoft.", status: 502 } };
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },
    async validateToken(accessToken) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            return true;
        } catch (error) {
            return false;
        }
    },
    _handleMicrosoftError(error) {
        const response = error.response;
        switch (response?.status) {
            case 400: return { code: response.data?.error, message: response.data?.error_description, status: response.status };
            case 401: return { code: "invalid_grant", message: "The refresh token is invalid or expired.", status: 401 };
            case 403: return { code: "insufficient_permissions", message: "The user does not have permission to access the resource.", status: 403 };
            default: return { code: "provider_error", message: "Unable to reach Microsoft authentication servers.", status: response?.status || 503 };
        }
    }
};