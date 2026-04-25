import axios from "axios";
const { IG_ClIENT_ID, IG_CLIENT_Secret, IG_REDIRECT_URI } = process.env;
export default {
    name: "instagram",
    getConfig() {
        return { clientId: IG_ClIENT_ID, clientSecret: IG_CLIENT_Secret, redirectUri: IG_REDIRECT_URI }
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: IG_ClIENT_ID, redirect_uri: IG_REDIRECT_URI, response_type: "code", force_reauth: true, scope: scopes.join(" "), state });
        return `https://www.instagram.com/oauth/authorize?${params}`;
    },
    async getTokens({ code }) {
        if (!code || typeof code !== 'string') return { success: false, tokenError: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const params = new URLSearchParams({ code, client_id: IG_ClIENT_ID, client_secret: IG_CLIENT_Secret, redirect_uri: IG_REDIRECT_URI, grant_type: "authorization_code" });
            const { data: shortLived } = await axios.post("https://api.instagram.com/oauth/access_token", params, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
            // console.log("Short-lived token:", JSON.stringify(shortLived, null, 2)); // one hour valid
            const { data: longLived } = await axios.get("https://graph.instagram.com/access_token", { params: { grant_type: "ig_exchange_token", client_secret: IG_CLIENT_Secret, access_token: shortLived.access_token } });
            // console.log("Long-lived token:", JSON.stringify(longLived, null, 2)); // 60 days valid
            const scope = shortLived.permissions;
            const { data: accountDetails } = await axios.get("https://graph.instagram.com/me", { params: { access_token: longLived.access_token, fields: "id,user_id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count" } });
            // console.log("Account details:", JSON.stringify(accountDetails, null, 2));
            const credentials = { accessToken: longLived.access_token, expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null, tokenType: longLived.token_type };
            return { success: true, credentials, scope, accountDetails };
        } catch (error) {
            return { success: false, tokenError: this._handleInstagramError(error) };
        }
    },
    async refreshToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.instagram.com/refresh_access_token", {
                params: {
                    grant_type: "ig_refresh_token",
                    access_token: accessToken,
                },
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },
    async getUserInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            // Without explicit fields, Instagram's /me only returns id and username
            const { data } = await axios.get("https://graph.instagram.com/v23.0/me", {
                params: { fields: "id,username,name,account_type" },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            return (!data)
                ? { success: false, error: { code: "malformed_response", message: "Invalid response from Instagram.", status: 502 } }
                : { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },
    async getTokenInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            // Instagram has no tokeninfo endpoint like Google. Use the debug_token
            // endpoint on the Graph API — requires an app access token as the auth.
            const appAccessToken = `${IG_ClIENT_ID}|${IG_CLIENT_Secret}`;
            const { data } = await axios.get("https://graph.facebook.com/v23.0/debug_token", { params: { input_token: accessToken, access_token: appAccessToken, } });
            console.log("tokeninfo:", data);
            const tokenData = data?.data;
            return (!tokenData)
                ? { success: false, error: { code: "malformed_response", message: "Invalid response from Instagram.", status: 502 } }
                : { success: true, data: { clientId: tokenData.app_id, scopes: tokenData.scopes || [], expiresIn: tokenData.expires_at ? tokenData.expires_at - Math.floor(Date.now() / 1000) : null, isValid: tokenData.is_valid } };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },
    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return false;
        try {
            await axios.get("https://graph.instagram.com/v23.0/me", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            return true;
        } catch (error) {
            return false;
        }
    },
    /**
     * Internal helper to categorize errors
     */
    _handleInstagramError(error) {
        const response = error.response;
        switch (response?.status) {
            case 400: return { code: response.data?.error_type || "invalid_request", message: response.data?.error_message || "Bad request.", status: 400 };
            case 401: return { code: response.data?.error?.type || "invalid_token", message: response.data?.error?.message || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Instagram validation servers.", status: 429 };
            default: {
                console.error(error.response.data);
                return { code: "provider_error", message: "Unable to reach Instagram authentication servers.", status: response?.status || 503 }
            };
        }
    }
}