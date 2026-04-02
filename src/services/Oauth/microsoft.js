import axios from "axios";
// ${process.env.AzureApplicationTenantId}
const BASE = `https://login.microsoftonline.com/common/oauth2/v2.0`;

export default {
    name: "microsoft",

    getScopes(scopeCategory) {
        const base = ["openid", "profile", "email", "offline_access","User.Read"  ];
        switch (scopeCategory) {
            case "excel.read": return [...base, "Files.Read",];
            case "excel.write": return [...base, "Files.ReadWrite",]; // ✅ recommended
            case "excel.full": return [...base, "Files.ReadWrite.All",]; // ⚠️ full tenant access   "Sites.ReadWrite.All",
            case "onedrive.read": return [...base, "Files.Read",];
            case "onedrive.write": return [...base, "Files.ReadWrite",];
            case "onedrive.full": return [...base, "Files.ReadWrite.All",];
            case "outlook.read": return [...base, "Mail.Read",];
            case "outlook.send": return [...base, "Mail.Send",];
            case "calendar.read": return [...base, "Calendars.Read",];
            case "calendar.write": return [...base, "Calendars.ReadWrite",];
            case "user.basic": return [...base, "User.Read",];
            default: return [...base, "Files.ReadWrite",];
        }
    },

    getAuthUrl({ state, scopeCategory }) {
        const params = new URLSearchParams({ client_id: process.env.AzureApplicationClientId, response_type: "code", redirect_uri: process.env.AZURE_REDIRECT_URI, response_mode: "query", scope: this.getScopes(scopeCategory).join(" "), state, prompt: "consent" });
        return `${BASE}/authorize?${params}`;
    },
    async getTokens(code) {
        try {
            const { data } = await axios.post(`${BASE}/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, code, redirect_uri: process.env.AZURE_REDIRECT_URI, grant_type: "authorization_code", }));
            return data;
            // { access_token, refresh_token, id_token, expires_in, ... }

        } catch (err) {
            console.error(err);
            const azureError = err.response?.data;
            throw {
                code: azureError?.error,                    // e.g. "invalid_grant"
                message: azureError?.error_description,     // human readable
                status: err.response?.status,               // 400, 401, etc
            };
        }
    },

    async refreshToken(refreshToken) {
        const res = await axios.post(
            `${BASE}/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, refresh_token: refreshToken, grant_type: "refresh_token", })
        );

        return res.data;
    },
    async getUserInfo(accessToken) {
        try {
            const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            return data;
        } catch (error) {
            throw {
                code: error.response?.data?.error,                    // e.g. "invalid_grant"
                message: JSON.stringify(error.response?.data?.error),     // human readable
                status: error.response?.status,               // 400, 401, etc
            };
            }
        }

    };