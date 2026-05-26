import axios from "axios";
const { wa_client_id, wa_client_secret, wa_redirect_uri, wa_config_id } = process.env;
export default {
    name: "whatsapp",
    getConfig() {
        return { clientId: wa_client_id, clientSecret: wa_client_secret, redirectUri: wa_redirect_uri, configId: wa_config_id };
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: wa_client_id, redirect_uri: wa_redirect_uri, config_id: wa_config_id, response_type: "code", scope: scopes.join(","), state });
        return `https://www.facebook.com/v23.0/dialog/oauth?${params}`;
    },
    async getTokens({ code }) {
        if (!code || typeof code !== "string") return { success: false, tokenError: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const shortLivedToken = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", { params: { code, client_id: wa_client_id, client_secret: wa_client_secret } }).then(res => {
                console.log("whatsapp short lived token:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting short lived token", err);
                return null;
            });
            const longLivedToken = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", { params: { grant_type: "fb_exchange_token", client_id: wa_client_id, client_secret: wa_client_secret, fb_exchange_token: shortLivedToken.access_token } }).then(res => {
                console.log("whatsapp long lived token:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting long lived token", err);
                return null;
            });
            const grantedScopes = await axios.get("https://graph.facebook.com/v23.0/me/permissions", { params: { access_token: longLivedToken.access_token } }).then(res => {
                console.log("whatsapp granted scopes:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting granted scopes", err);
                return null;
            });
            const scope = grantedScopes.filter(item => item.status === "granted").map(item => item.permission);

            return {
                success: true,
                credentials: {
                    accessToken: longLivedToken.access_token,
                    expiresAt: null,
                    tokenType: longLivedToken.token_type
                },
                scope
            };
        } catch (error) {
            return { success: false, tokenError: this._handleWhatsAppError(error) };
        }
    },
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const API_VERSION = 'v23.0';
        const { phone_number_id, waba_id, business_id } = config;
        config.webhookUrl = webhookUrl;
        config.verificationToken = `LeanOn_${channelId}`;
        config.phoneNumberPin = Math.floor(Math.random() * 900000) + 100000;
        let webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`
        const { expiresAt, accessToken, tokenType } = apiAuthenticator.credentials;
        if (!expiresAt || !accessToken || !tokenType) return { success: false, error: { code: "missing_credentials", message: "Missing credentials.", status: 400 } };
        if (expiresAt < Date.now()) {
            const { success, data } = await this.refreshToken(accessToken);
            if (!success) return { success: false, error: data };
            apiAuthenticator.credentials.accessToken = data.access_token;
            apiAuthenticator.credentials.expiresAt = data.expires_in ? new Date(Date.now() + (data.expires_in * 1000)) : null;
            apiAuthenticator.credentials.tokenType = data.token_type;
            await apiAuthenticator.save();
        }
        try {
            console.log("settingUp webhooks")
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`, { "override_callback_uri": config.webhookUrl, "verify_token": config.verificationToken }, { headers: { 'Authorization': `Bearer ${accessToken}` } }).then(res => {
                console.log("webhook set", res.data);
            }).catch(err => {
                console.error("error setting webhook", err);
            });
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`, { 'messaging_product': 'whatsapp', 'pin': config.phoneNumberPin }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` } }).then(res => {
                console.log("phone number registered", res.data);
            }).catch(err => {
                console.error("error registering phone number", err);
            });
            return { success: true, config };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async refreshToken(accessToken) {
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
    async getUserInfo({ accessToken }) {
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
    async getTokenInfo({ accessToken }) {
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
    async validateToken({ accessToken }) {
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
            default: {
                console.error(error)
                return { code: "provider_error", message: "Unable to reach Meta authentication servers.", status: response?.status || 503 };
            }
        }
    },
};