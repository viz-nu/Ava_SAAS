import { Telegraf } from "telegraf";
export default {
    name: "telegram",
    async getTokens({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") return { success: false, tokenError: { code: "missing_apiToken", message: "An apiToken string is required.", status: 400 } };
        try {
            const client = new Telegraf(apiToken);
            const botInfo = await client.telegram.getMe();
            return {
                success: true,
                credentials: {
                    apiToken: apiToken
                },
                accountDetails: botInfo,
                config: {},
                scope: []
            };
        } catch (error) {
            return { success: false, tokenError: this._handleWhatsAppError(error) };
        }
    },
    async getUserInfo({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const client = new Telegraf(apiToken);
            const botInfo = await client.telegram.getMe();
            return { success: true, data: botInfo };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
    async setupChannel({ apiAuthenticator, providerName, channelId }) {
        let webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`
        const { apiToken } = apiAuthenticator.credentials;
        try {
            const client = new Telegraf(apiToken);
            await client.telegram.setWebhook(webhookUrl);
            return { success: true, config: { webhookUrl } };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }

    },



    async getTokenInfo({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") {
            return { success: false, error: { code: "missing_token", message: "An apiToken string is required.", status: 400 } };
        }
        try {
            const client = new Telegraf(apiToken);
            const botInfo = await client.telegram.getMe();
            return {
                success: true,
                data: {
                    clientId: String(botInfo.id),
                    scopes: [],
                    expiresIn: null,   // Bot tokens never expire unless revoked
                    isValid: true,
                    botInfo,
                },
            };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async validateToken({ apiToken }) {
        if (!apiToken || typeof apiToken !== "string") return false;
        try {
            const client = new Telegraf(apiToken);
            await client.telegram.getMe();
            return true;
        } catch {
            return false;
        }
    },
 
    /** ----------------------------
     *  Webhook management
     * -----------------------------*/
 
    async getWebhookInfo({ apiToken }) {
        try {
            const client = new Telegraf(apiToken);
            const info = await client.telegram.getWebhookInfo();
            return { success: true, data: info };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async deleteWebhook({ apiToken, dropPendingUpdates = false }) {
        try {
            const client = new Telegraf(apiToken);
            await client.telegram.deleteWebhook({ drop_pending_updates: dropPendingUpdates });
            return { success: true };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    /** ----------------------------
     *  Sending messages
     * Rate limits: 30 msg/s global, 1 msg/s per chat, 20 msg/min in groups.
     * Always read retry_after from 429 responses; never hardcode backoff.
     * -----------------------------*/
 
    async sendMessage({ apiToken, chatId, text, parseMode, replyMarkup, disableNotification }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendMessage"), {
                chat_id: chatId,
                text,
                ...(parseMode && { parse_mode: parseMode }),
                ...(replyMarkup && { reply_markup: replyMarkup }),
                ...(disableNotification && { disable_notification: disableNotification }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async sendPhoto({ apiToken, chatId, photo, caption, parseMode }) {
        // photo: file_id string, URL, or Buffer
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendPhoto"), {
                chat_id: chatId,
                photo,
                ...(caption && { caption }),
                ...(parseMode && { parse_mode: parseMode }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async sendDocument({ apiToken, chatId, document, caption }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendDocument"), {
                chat_id: chatId, document, ...(caption && { caption }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async sendAudio({ apiToken, chatId, audio, caption }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendAudio"), {
                chat_id: chatId, audio, ...(caption && { caption }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async sendVideo({ apiToken, chatId, video, caption }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendVideo"), {
                chat_id: chatId, video, ...(caption && { caption }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async sendLocation({ apiToken, chatId, latitude, longitude }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "sendLocation"), { chat_id: chatId, latitude, longitude });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async editMessage({ apiToken, chatId, messageId, text, parseMode }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "editMessageText"), {
                chat_id: chatId,
                message_id: messageId,
                text,
                ...(parseMode && { parse_mode: parseMode }),
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async deleteMessage({ apiToken, chatId, messageId }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "deleteMessage"), { chat_id: chatId, message_id: messageId });
            if (!data.ok) throw new Error(data.description);
            return { success: true };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async answerCallbackQuery({ apiToken, callbackQueryId, text, showAlert = false }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "answerCallbackQuery"), {
                callback_query_id: callbackQueryId,
                ...(text && { text }),
                show_alert: showAlert,
            });
            if (!data.ok) throw new Error(data.description);
            return { success: true };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    /** ----------------------------
     *  Rate limit headers (Bot API 8.0+)
     * Read X-RateLimit-Remaining before bulk dispatch.
     * -----------------------------*/
 
    async getRateLimitStatus({ apiToken }) {
        try {
            const response = await axios.get(botUrl(apiToken, "getMe"));
            return {
                success: true,
                data: {
                    limit: response.headers["x-ratelimit-limit"] || null,
                    remaining: response.headers["x-ratelimit-remaining"] || null,
                    reset: response.headers["x-ratelimit-reset"] || null,
                },
            };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    /** ----------------------------
     *  Bot / Chat info
     * -----------------------------*/
 
    async getChat({ apiToken, chatId }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "getChat"), { chat_id: chatId });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },
 
    async getChatMemberCount({ apiToken, chatId }) {
        try {
            const { data } = await axios.post(botUrl(apiToken, "getChatMemberCount"), { chat_id: chatId });
            if (!data.ok) throw new Error(data.description);
            return { success: true, data: data.result };
        } catch (error) {
            return { success: false, error: this._handleTelegramError(error) };
        }
    },



    
    _handleTelegramError(error) {
        const response = error.response;
        const telegramError = response?.data?.error;
        switch (response?.status) {
            case 400: return { code: telegramError?.code || "invalid_request", message: telegramError?.message || "Bad request.", status: 400 };
            case 401: return { code: telegramError?.type || "invalid_token", message: telegramError?.message || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Telegram servers.", status: 429 };
            default: return { code: "provider_error", message: "Unable to reach Telegram authentication servers.", status: response?.status || 503 };
        }
    },
};