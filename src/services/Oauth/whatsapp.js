import axios from "axios";
const { wa_client_id, wa_client_secret, wa_redirect_uri } = process.env;
// WhatsApp Business Cloud API authenticates through Meta's OAuth2 infrastructure.
// After token exchange you'll also need the WABA ID and Phone Number ID from
// the business account — these are fetched via getUserInfo and stored alongside
// the access token in your credentials store.

export default {
    name: "whatsapp",
    getConfig() {
        return {
            clientId: wa_client_id,
            clientSecret: wa_client_secret,
            redirectUri: wa_redirect_uri
        };
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({
            client_id: wa_client_id,
            redirect_uri: wa_redirect_uri,
            response_type: "code",
            scope: scopes.join(","),
            state,
        });
        return `https://www.facebook.com/v23.0/dialog/oauth?${params}`;
    },
    async getTokens(code) {
        if (!code || typeof code !== "string") return { success: false, error: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", {
                params: {
                    code,
                    client_id: wa_client_id,
                    client_secret: wa_client_secret,
                    redirect_uri: wa_redirect_uri,
                },
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async refreshToken(accessToken) {
        // Meta short-lived tokens are exchanged for long-lived tokens (60 days)
        // in a single step. There is no traditional refresh_token grant — instead,
        // call this with the current access token to extend it.
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", {
                params: {
                    grant_type: "fb_exchange_token",
                    client_id: wa_client_id,
                    client_secret: wa_client_secret,
                    fb_exchange_token: accessToken,
                },
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async getUserInfo(accessToken) {
        // Returns the user identity and all WhatsApp Business Accounts (WABAs)
        // they have access to. Store waba.id and phone_numbers[].id from here.
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.facebook.com/v23.0/me", {
                params: {
                    fields: "id,name,granular_scopes",
                },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!data) return { success: false, error: { code: "malformed_response", message: "Invalid response from Meta.", status: 502 } };

            // Fetch the WABAs this user has access to so callers can store them
            const wabaRes = await axios.get(`https://graph.facebook.com/v23.0/${data.id}/businesses`, {
                params: { fields: "id,name,whatsapp_business_accounts{id,name,timezone_id,message_template_namespace}" },
                headers: { Authorization: `Bearer ${accessToken}` },
            }).catch(() => ({ data: null }));

            return {
                success: true,
                data: {
                    ...data,
                    businesses: wabaRes.data?.data || [],
                },
            };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async getTokenInfo(accessToken) {
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get("https://graph.facebook.com/v23.0/debug_token", {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
            });
            console.log("tokeninfo:", data);
            const tokenData = data?.data;
            return (!tokenData)
                ? { success: false, error: { code: "malformed_response", message: "Invalid response from Meta.", status: 502 } }
                : {
                    success: true,
                    data: {
                        clientId: tokenData.app_id,
                        scopes: tokenData.scopes || [],
                        expiresIn: tokenData.expires_at ? tokenData.expires_at - Math.floor(Date.now() / 1000) : null,
                        isValid: tokenData.is_valid,
                        type: tokenData.type,
                    },
                };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async validateToken(accessToken) {
        if (!accessToken || typeof accessToken !== "string") return false;
        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get("https://graph.facebook.com/v23.0/debug_token", {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
            });
            return data?.data?.is_valid === true;
        } catch (error) {
            return false;
        }
    },
    _handleWhatsAppError(error) {
        const response = error.response;
        const fbError = response?.data?.error;
        switch (response?.status) {
            case 400: return { code: fbError?.code || "invalid_request", message: fbError?.message || "Bad request.", status: 400 };
            case 401: return { code: fbError?.type || "invalid_token", message: fbError?.message || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Meta servers.", status: 429 };
            default: return { code: "provider_error", message: "Unable to reach Meta authentication servers.", status: response?.status || 503 };
        }
    },
};