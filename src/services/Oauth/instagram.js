import axios from "axios";

const { IG_CLIENT_ID, IG_CLIENT_SECRET, IG_REDIRECT_URI } = process.env;
const API_VERSION = "v23.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const IG_BASE = `https://graph.instagram.com/${API_VERSION}`;

function authHeaders(accessToken) {
    return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

export default {
    name: "instagram",

    getConfig() {
        return { clientId: IG_CLIENT_ID, clientSecret: IG_CLIENT_SECRET, redirectUri: IG_REDIRECT_URI };
    },

    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({
            client_id: IG_CLIENT_ID,
            redirect_uri: IG_REDIRECT_URI,
            response_type: "code",
            force_reauth: true,
            scope: scopes.join(" "),
            state,
        });
        return `https://www.instagram.com/oauth/authorize?${params}`;
    },

    async getTokens({ code }) {
        if (!code || typeof code !== "string") {
            return { success: false, tokenError: { code: "missing_code", message: "A code string is required.", status: 400 } };
        }
        try {
            // Step 1: short-lived token (1 hour)
            const params = new URLSearchParams({ code, client_id: IG_CLIENT_ID, client_secret: IG_CLIENT_SECRET, redirect_uri: IG_REDIRECT_URI, grant_type: "authorization_code" });
            const { data: shortLived } = await axios.post("https://api.instagram.com/oauth/access_token", params, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            // Step 2: long-lived token (60 days)
            const { data: longLived } = await axios.get("https://graph.instagram.com/access_token", {
                params: { grant_type: "ig_exchange_token", client_secret: IG_CLIENT_SECRET, access_token: shortLived.access_token },
            });

            // Step 3: account details + linked page ID (needed for webhook subscription and messaging)
            const { data: accountDetails } = await axios.get(`${IG_BASE}/me`, {
                params: { access_token: longLived.access_token, fields: "id,user_id,username,account_type,name,profile_picture_url,followers_count,follows_count,media_count" },
            });

            // Step 4: get the Facebook Page linked to this IG account (required for messaging webhooks)
            const linkedPage = await this._getLinkedPage(longLived.access_token, accountDetails.id).catch(() => null);

            const credentials = {
                accessToken: longLived.access_token,
                expiresAt: longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000) : null,
                tokenType: longLived.token_type,
                igUserId: accountDetails.id,
                pageId: linkedPage?.id || null,
                pageAccessToken: linkedPage?.access_token || null,
            };

            return {
                success: true,
                credentials,
                scope: shortLived.permissions || [],
                accountDetails: { ...accountDetails, linkedPage },
            };
        } catch (error) {
            return { success: false, tokenError: this._handleInstagramError(error) };
        }
    },

    // Subscribes the connected Facebook Page to Instagram messaging webhooks.
    // This is what enables the agent to receive DMs, story replies, and comment mentions.
    // Requires config: { pageId } — or it falls back to credentials.pageId
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`;
        const verifyToken = `LeanOn_${channelId}`;
        const { accessToken, pageId: credPageId, pageAccessToken } = apiAuthenticator.credentials;
        const pageId = config?.pageId || credPageId;

        if (!pageId) {
            return { success: false, error: { code: "missing_page_id", message: "A Facebook Page ID linked to this Instagram account is required. Set config.pageId or ensure getTokens retrieved it.", status: 400 } };
        }

        // Use page access token if available, otherwise fall back to user token
        const token = pageAccessToken || accessToken;

        try {
            // Subscribe the Page to Instagram webhooks (messages field = DMs)
            // POST /{page-id}/subscribed_apps
            await axios.post(`${BASE_URL}/${pageId}/subscribed_apps`, null, {
                params: {
                    access_token: token,
                    subscribed_fields: "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads,messaging_referrals",
                },
            });

            // Register webhook callback URL + verify token at the app level
            // POST /app/subscriptions  (app-level; requires app access token)
            const appToken = `${IG_CLIENT_ID}|${IG_CLIENT_SECRET}`;
            await axios.post(`${BASE_URL}/app/subscriptions`, null, {
                params: {
                    access_token: appToken,
                    object: "instagram",
                    callback_url: webhookUrl,
                    verify_token: verifyToken,
                    fields: "messages,messaging_postbacks,story_insights",
                    include_values: true,
                },
            }).catch(err => {
                // App-level subscription may already exist or require dashboard setup
                console.warn("App subscription registration warning:", err?.response?.data || err.message);
            });

            return {
                success: true,
                config: { ...config, webhookUrl, verifyToken, pageId },
            };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async refreshToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        }
        try {
            const { data } = await axios.get("https://graph.instagram.com/refresh_access_token", {
                params: { grant_type: "ig_refresh_token", access_token: accessToken },
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async getUserInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        }
        try {
            const { data } = await axios.get(`${IG_BASE}/me`, {
                params: { fields: "id,username,name,account_type,followers_count,media_count" },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!data) return { success: false, error: { code: "malformed_response", message: "Invalid response from Instagram.", status: 502 } };
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async getTokenInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        }
        try {
            const appAccessToken = `${IG_CLIENT_ID}|${IG_CLIENT_SECRET}`;
            const { data } = await axios.get(`${BASE_URL}/debug_token`, {
                params: { input_token: accessToken, access_token: appAccessToken },
            });
            const tokenData = data?.data;
            return (!tokenData)
                ? { success: false, error: { code: "malformed_response", message: "Invalid response from Instagram.", status: 502 } }
                : { success: true, data: { clientId: tokenData.app_id, scopes: tokenData.scopes || [], expiresIn: tokenData.expires_at ? tokenData.expires_at - Math.floor(Date.now() / 1000) : null, isValid: tokenData.is_valid } };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") return false;
        try {
            await axios.get(`${IG_BASE}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
            return true;
        } catch {
            return false;
        }
    },

    /** ----------------------------
     *  Messaging (send)
     * All outbound messages require the Page Access Token and the recipient's IGSID.
     * Messages can only be sent within a 24-hour window of the user's last message.
     * -----------------------------*/

    async sendTextMessage({ pageId, pageAccessToken, recipientId, text }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${pageId}/messages`, {
                recipient: { id: recipientId },
                message: { text },
            }, { headers: authHeaders(pageAccessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async sendMediaMessage({ pageId, pageAccessToken, recipientId, type, url }) {
        // type: 'image' | 'video' | 'audio'
        try {
            const { data } = await axios.post(`${BASE_URL}/${pageId}/messages`, {
                recipient: { id: recipientId },
                message: { attachment: { type, payload: { url, is_reusable: true } } },
            }, { headers: authHeaders(pageAccessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async sendQuickReplies({ pageId, pageAccessToken, recipientId, text, quickReplies }) {
        // quickReplies: [{ content_type: 'text', title: 'Yes', payload: 'YES' }]
        try {
            const { data } = await axios.post(`${BASE_URL}/${pageId}/messages`, {
                recipient: { id: recipientId },
                message: { text, quick_replies: quickReplies },
            }, { headers: authHeaders(pageAccessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async replyToComment({ accessToken, commentId, message }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${commentId}/replies`, { message }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    /** ----------------------------
     *  Conversations / Inbox
     * -----------------------------*/

    async getConversations({ pageId, pageAccessToken }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${pageId}/conversations`, {
                params: { platform: "instagram", fields: "participants,messages{message,from,created_time}" },
                headers: authHeaders(pageAccessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    async getConversationMessages({ conversationId, pageAccessToken }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${conversationId}`, {
                params: { fields: "messages{message,from,created_time,attachments}" },
                headers: authHeaders(pageAccessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    /** ----------------------------
     *  Rate Limit Status
     * -----------------------------*/

    // Returns the X-Business-Use-Case-Usage data from the response headers.
    // Call this before bulk operations to check remaining quota.
    async getRateLimitStatus({ accessToken, igUserId }) {
        try {
            const response = await axios.get(`${BASE_URL}/${igUserId}`, {
                params: { fields: "id" },
                headers: authHeaders(accessToken),
            });
            const usage = response.headers["x-business-use-case-usage"];
            return { success: true, data: usage ? JSON.parse(usage) : null };
        } catch (error) {
            return { success: false, error: this._handleInstagramError(error) };
        }
    },

    /** ----------------------------
     *  Internal helpers
     * -----------------------------*/

    async _getLinkedPage(accessToken, igUserId) {
        // Fetch the Facebook Pages that have this IG account linked.
        // Returns the first matching page with its page-scoped access token.
        try {
            const { data } = await axios.get(`${BASE_URL}/me/accounts`, {
                params: { fields: "id,name,access_token,instagram_business_account", access_token: accessToken },
            });
            const pages = data?.data || [];
            const linkedPage = pages.find(p => p.instagram_business_account?.id === igUserId);
            return linkedPage || pages[0] || null;
        } catch {
            return null;
        }
    },

    _handleInstagramError(error) {
        const response = error.response;
        const fbError = response?.data?.error;
        switch (response?.status) {
            case 400: return { code: fbError?.error_type || fbError?.code || "invalid_request", message: fbError?.message || "Bad request.", status: 400 };
            case 401: return { code: fbError?.type || "invalid_token", message: fbError?.message || "The token is expired or invalid.", status: 401 };
            case 403: return { code: "permission_denied", message: fbError?.message || "Missing required permission or outside 24-hour messaging window.", status: 403 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Instagram. Limit: 200 calls/hr per user, 200 DMs/hr.", status: 429 };
            default: {
                console.error(error?.response?.data);
                return { code: "provider_error", message: "Unable to reach Instagram servers.", status: response?.status || 503 };
            }
        }
    },
};