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
    async setWebhook({ apiAuthenticator, webhookUrl }) {
        const { apiToken } = apiAuthenticator.credentials;
        try {
            const client = new Telegraf(apiToken);
            await client.telegram.setWebhook(webhookUrl);
            return { success: true };
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