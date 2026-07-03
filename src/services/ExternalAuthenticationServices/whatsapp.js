import axios from "axios";
import BaseOAuthProvider from "./base.js";
const { wa_client_id, wa_client_secret, wa_redirect_uri } = process.env;

const API_VERSION = "v23.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
/**
 * FIXED: WhatsApp OAuth Provider
 * 
 * Fixes applied:
 * ✓ Extends BaseOAuthProvider
 * ✓ Changed tokenError → error in getTokens
 * ✓ refreshToken() uses accessToken (Meta long-lived token exchange, no refresh_token)
 * ✓ ADDED missing redirectUri to getConfig()
 * ✓ Standardized response structure
 * ✓ Added null safety in error handling
 * ✓ Removed messaging/API methods (sendTextMessage, etc.) - see WhatsAppMessagingAPI class
 * ✓ Removed setupChannel - moved to WhatsAppSetupAPI
 * 
 * NOTE: WhatsApp OAuth uses Facebook's long-lived token exchange (fb_exchange_token).
 * Long-lived tokens don't expire (or expire in ~60 days), unlike OAuth 2.0 standard.
 * Messaging APIs and webhook setup are NOT in this class.
 * Use WhatsAppMessagingAPI and WhatsAppSetupAPI for those operations.
 */

export default class OauthWhatsApp extends BaseOAuthProvider {
    name = "whatsapp";

    getConfig() {
        return {
            clientId: wa_client_id,
            clientSecret: wa_client_secret,
            redirectUri: wa_redirect_uri, // FIX: Was missing
        };
    }

    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({
            client_id: wa_client_id,
            redirect_uri: wa_redirect_uri,
            config_id: process.env.wa_config_id,
            response_type: "code",
            // WhatsApp uses comma-separated scopes
            scope: scopes.join(","),
            state,
        });
        return { AuthUrl: `https://www.facebook.com/${API_VERSION}/dialog/oauth?${params}` };
    }

    async getTokens({ code }) {
        // FIX #1: Validate code parameter
        const validation = this._validateStringParam(code, "code");
        if (validation) return validation;

        try {
            // Step 1: Exchange code for short-lived token
            const shortLivedResponse = await axios.get(
                "https://graph.facebook.com/v23.0/oauth/access_token",
                {
                    params: {
                        code,
                        client_id: wa_client_id,
                        client_secret: wa_client_secret,
                    },
                }
            );

            const shortLived = shortLivedResponse.data;
            if (!shortLived?.access_token) {
                return this._errorResponse(
                    "malformed_response",
                    "Failed to obtain short-lived token.",
                    502
                );
            }

            // Step 2: Exchange for long-lived token (60+ days, essentially permanent)
            const longLivedResponse = await axios.get(
                "https://graph.facebook.com/v23.0/oauth/access_token",
                {
                    params: {
                        grant_type: "fb_exchange_token",
                        client_id: wa_client_id,
                        client_secret: wa_client_secret,
                        fb_exchange_token: shortLived.access_token,
                    },
                }
            );

            const longLived = longLivedResponse.data;
            if (!longLived?.access_token) {
                return this._errorResponse(
                    "malformed_response",
                    "Failed to obtain long-lived token.",
                    502
                );
            }

            // Step 3: Fetch account details
            const accountDetailsResponse = await axios.get(
                `${BASE_URL}/me`,
                {
                    params: {
                        fields:
                            "id,name,first_name,last_name,middle_name,name_format,picture,short_name",
                    },
                    headers: {
                        Authorization: `Bearer ${longLived.access_token}`,
                    },
                }
            );

            const accountDetails = accountDetailsResponse.data;
            if (!accountDetails || !accountDetails.id) {
                return this._errorResponse(
                    "malformed_response",
                    "Failed to fetch account details.",
                    502
                );
            }

            // Step 4: Get granted scopes (permissions)
            const scopesResponse = await axios.get(
                `${BASE_URL}/me/permissions`,
                {
                    params: { access_token: longLived.access_token },
                }
            );

            const grantedScopes = scopesResponse.data?.data
                ?.filter((item) => item.status === "granted")
                ?.map((item) => item.permission) || [];

            const credentials = {
                accessToken: longLived.access_token,
                refreshToken: null, // Facebook long-lived tokens don't use refresh tokens
                tokenType: longLived.token_type || "Bearer",
                // Long-lived tokens don't have meaningful expiry (60+ days typically)
                expiresAt: longLived.expires_in
                    ? new Date(Date.now() + longLived.expires_in * 1000)
                    : null,
                expiresIn: longLived.expires_in,
                refreshTokenExpiresAt: null,
            };

            return this._successResponse(credentials, {
                scope: grantedScopes,
                accountDetails,
                config: this.getConfig(),
            });
        } catch (error) {
            return this._handleError(error);
        }
    }
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const { phone_number_id, waba_id } = config;

        if (!phone_number_id || !waba_id) {
            return this._errorResponse("missing_config", "phone_number_id and waba_id are required.", 400);
        }
        const accessToken = apiAuthenticator?.credentials?.accessToken;
        if (!accessToken) {
            return this._errorResponse("missing_credentials", "Missing access token.", 400);
        }

        const base = (process.env.WEBHOOKS_URL || "").replace(/\/?$/, "/");
        config.webhookUrl = `${base}webhook/${providerName}/${channelId}`;
        config.verificationToken = `LeanOn_${channelId}`;
        config.phoneNumberPin = "000000";

        const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } };
        const steps = {};

        // CRITICAL — route this WABA's webhooks to us
        steps.subscription = await this._safeStep("subscription", () =>
            axios.post(`${BASE_URL}/${waba_id}/subscribed_apps`, {
                override_callback_uri: config.webhookUrl,
                verify_token: config.verificationToken,
            }, auth)
        );

        // CRITICAL — register number ("already registered" is success)
        steps.registration = await this._safeStep("registration", () =>
            axios.post(`${BASE_URL}/${phone_number_id}/register`, {
                messaging_product: "whatsapp",
                pin: config.phoneNumberPin,
            }, auth),
            { okErrorCodes: [133016] }
        );

        // OPTIONAL — calling fails gracefully on sub-2000-tier numbers
        steps.calling = await this._safeStep("calling", () =>
            axios.post(`${BASE_URL}/${phone_number_id}/settings`, {
                calling: {
                    status: "ENABLED",
                    call_icon_visibility: "DEFAULT",
                    callback_permission_status: "ENABLED",
                    audio: { additional_codecs: ["PCMU", "PCMA"] },
                },
            }, auth),
            { optional: true }
        );

        // capabilities live INSIDE config so they persist via ...restConfigurations
        config.capabilities = {
            messaging: steps.subscription.ok && steps.registration.ok,
            calling: steps.calling.ok,
        };
        if (!config.capabilities.messaging) config.errors = Object.values(steps).filter(s => !s.ok && !s.optional).map(s => `${s.name}(code=${s.code ?? "?"}, trace=${s.fbtrace_id ?? "?"})`).join("; ");
        // success: matches _successResponse(data, { config }) -> { success, data, config }
        return this._successResponse(config, { config });
    }
    /**
 * Runs one setup step in isolation. Never throws.
 * - optional: failure won't fail the channel (e.g. calling on a low-tier number)
 * - okErrorCodes: Meta error codes to treat as success (idempotency, e.g. "already registered")
 */
    async _safeStep(name, fn, { optional = false, okErrorCodes = [] } = {}) {
        try {
            const res = await fn();
            return { ok: true, name, data: res.data };
        } catch (error) {
            const fbError = error?.response?.data?.error || {};
            const code = fbError.code;

            // Idempotency: some "errors" mean "already in the desired state"
            if (okErrorCodes.includes(code)) {
                return { ok: true, name, idempotent: true, note: fbError.message };
            }

            const detail = {
                ok: false,
                name,
                optional,
                httpStatus: error?.response?.status ?? null,
                code: code ?? null,
                subcode: fbError.error_subcode ?? null,
                message: fbError.message || error.message,
                fbtrace_id: fbError.fbtrace_id ?? null, // give this to Meta support if needed
            };
            console.error(`[setupChannel:${name}] failed`, detail);
            return detail;
        }
    }
    async refreshToken({ accessToken }) {
        // Meta has no refresh_token — extend validity by re-exchanging the long-lived access token
        const validation = this._validateStringParam(accessToken, "accessToken");
        if (validation) return validation;

        try {
            const { data } = await axios.get(
                `${BASE_URL}/oauth/access_token`,
                {
                    params: {
                        grant_type: "fb_exchange_token",
                        client_id: wa_client_id,
                        client_secret: wa_client_secret,
                        fb_exchange_token: accessToken,
                    },
                }
            );

            if (!data?.access_token) {
                return this._errorResponse(
                    "malformed_response",
                    "Failed to refresh token.",
                    502
                );
            }

            const refreshed = {
                accessToken: data.access_token,
                refreshToken: null,
                tokenType: data.token_type || "Bearer",
                expiresAt: data.expires_in
                    ? new Date(Date.now() + data.expires_in * 1000)
                    : null,
                expiresIn: data.expires_in,
                refreshTokenExpiresAt: null,
            };

            return this._successResponse(refreshed);
        } catch (error) {
            return this._handleError(error);
        }
    }

    async getUserInfo({ accessToken }) {
        // FIX: Validate accessToken parameter
        const validation = this._validateStringParam(accessToken, "accessToken");
        if (validation) return validation;

        try {
            // Fetch user identity and WhatsApp Business Accounts (WABAs) they have access to
            const { data } = await axios.get(`${BASE_URL}/me`, {
                params: {
                    fields: "id,name",
                },
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 5000,
            });

            if (!data || !data.id) {
                return this._errorResponse(
                    "malformed_response",
                    "Invalid response from Meta.",
                    502
                );
            }

            // Fetch the WABAs (WhatsApp Business Accounts) this user has access to
            const wabaResponse = await axios.get(
                `${BASE_URL}/${data.id}/businesses`,
                {
                    params: {
                        fields:
                            "id,name,whatsapp_business_accounts{id,name,timezone_id,message_template_namespace}",
                    },
                    headers: { Authorization: `Bearer ${accessToken}` },
                }
            ).catch(() => ({ data: null }));

            return this._successResponse({
                id: data.id,
                name: data.name,
                businesses: wabaResponse.data?.data || [],
            });
        } catch (error) {
            return this._handleError(error);
        }
    }
    /**
     * OPTIONAL: Get token metadata (validity, scopes, etc.)
     * Provider-specific, not in base interface
     */
    async getTokenInfo({ accessToken }) {
        // FIX: Validate accessToken parameter
        const validation = this._validateStringParam(accessToken, "accessToken");
        if (validation) return validation;

        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get(`${BASE_URL}/debug_token`, {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
            });

            if (!data?.data) {
                return this._errorResponse(
                    "malformed_response",
                    "Invalid response from Meta.",
                    502
                );
            }

            const tokenData = data.data;
            return this._successResponse({
                clientId: tokenData.app_id,
                scopes: tokenData.scopes || [],
                expiresIn: tokenData.expires_at
                    ? tokenData.expires_at - Math.floor(Date.now() / 1000)
                    : null,
                isValid: tokenData.is_valid,
                type: tokenData.type,
            });
        } catch (error) {
            return this._handleError(error);
        }
    }

    async validateToken({ accessToken }) {
        // FIX: ALWAYS return boolean
        if (!accessToken || typeof accessToken !== "string") return false;

        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get(`${BASE_URL}/debug_token`, {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
                timeout: 5000,
            });
            return data?.data?.is_valid === true;
        } catch {
            return false;
        }
    }
    async teardownChannel({ apiAuthenticator, config }) {
        const { phone_number_id, waba_id } = config || {};
        const accessToken = apiAuthenticator?.credentials?.accessToken;
        if (!accessToken) {
            return this._errorResponse("missing_credentials", "Missing access token.", 400);
        }

        const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } };
        const steps = {};

        // 1) Disable calling first (stops new call webhooks). Optional — number may have none.
        if (phone_number_id) {
            steps.disableCalling = await this._safeStep("disableCalling", () =>
                axios.post(`${BASE_URL}/${phone_number_id}/settings`, {
                    calling: { status: "DISABLED" },
                }, auth),
                { optional: true }
            );

            // 2) Deregister the number. Tolerate "not registered".
            steps.deregister = await this._safeStep("deregister", () =>
                axios.post(`${BASE_URL}/${phone_number_id}/deregister`, {}, auth),
                { optional: true }
            );
        }

        // 3) Unsubscribe our app from this WABA — stops ALL webhooks for it.
        if (waba_id) {
            steps.unsubscribe = await this._safeStep("unsubscribe", () =>
                axios.delete(`${BASE_URL}/${waba_id}/subscribed_apps`, auth),
                { optional: true }
            );
        }

        const teardown = Object.fromEntries(
            Object.entries(steps).map(([k, v]) => [k, v.ok])
        );

        // Always success: report what cleaned up, but never block channel deletion.
        return this._successResponse({ teardown }, { config: { ...config, teardown } });
    }
    async listTemplates({ secrets, parameters = { limit: 20, afterCursor: null, fields: "id,name,status,category,language,components,quality_score,rejected_reason,last_updated_time,source" } }) {
        const accessToken = secrets.authentcatorDoc.credentials.accessToken;
        const wabaId = secrets.channelConfig.wabaId;
        const { limit, afterCursor, fields } = parameters;
        try {
            const { data } = await axios.get(`${BASE_URL}/${API_VERSION}/${wabaId}/message_templates`, { params: { limit, afterCursor, fields, }, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } });
            return data;
        } catch (error) {
            return this._handleError(error);
        }
    }
    async getTemplate({ secrets, parameters = {} }) {
        const accessToken = secrets.authentcatorDoc.credentials.accessToken;
        const wabaId = secrets.channelConfig.wabaId;
        const { templateId } = parameters;
        try {
            const { data } = await axios.get(`${BASE_URL}/${API_VERSION}/${wabaId}/message_templates/${templateId}`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } });
            return data;
        } catch (error) {
            return this._handleError(error);
        }
    }
    async createTemplate({ secrets, parameters = {} }) {
        const accessToken = secrets.authentcatorDoc.credentials.accessToken;
        const wabaId = secrets.channelConfig.wabaId;
        const { body } = parameters;
        try {
            const { data } = await axios.post(`${BASE_URL}/${API_VERSION}/${wabaId}/message_templates`, body, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } });
            return data;
        } catch (error) {
            return this._handleError(error);
        }
    }
    async updateTemplate({ secrets, parameters = {} }) {
        const accessToken = secrets.authentcatorDoc.credentials.accessToken;
        const wabaId = secrets.channelConfig.wabaId;
        const { updates, templateId } = parameters;
        try {
            const { data } = await axios.post(`${BASE_URL}/${API_VERSION}/${wabaId}/message_templates/${templateId}`, updates, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } });
            return data;
        } catch (error) {
            return this._handleError(error);
        }
    }
    async deleteTemplate({ secrets, parameters = {} }) {
        const accessToken = secrets.authentcatorDoc.credentials.accessToken;
        const wabaId = secrets.channelConfig.wabaId;
        const { templateId } = parameters;
        try {
            const { data } = await axios.delete(`${BASE_URL}/${API_VERSION}/${wabaId}/message_templates`, { params: { hsm_id: templateId }, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` } });
            return data;
        } catch (error) {
            return this._handleError(error);
        }
    }
    listChannelSettingMethods() {
        return [
            {
                name: "listTemplates",
                description: "List all templates",
                parameters: {
                    limit: {
                        type: "number",
                        description: "The limit of the templates to list",
                        default: 20,
                    },
                    afterCursor: {
                        type: "string",
                        description: "The cursor to the next page of templates",
                    },
                    fields: {
                        type: "string",
                        description: "The fields to return",
                        default: "id,name,status,category,language,components,quality_score,rejected_reason,last_updated_time,source",
                    },
                },
                returns: {
                    type: "array",
                    description: "The list of templates",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            status: { type: "string" },
                            category: { type: "string" },
                            language: { type: "string" },
                            components: { type: "array" },
                            quality_score: { type: "number" },
                            rejected_reason: { type: "string" },
                            last_updated_time: { type: "string" },
                            source: { type: "string" },
                        },
                    },
                },
            },
            {
                name: "getTemplate",
                description: "Get a template by ID",
                parameters: {
                    templateId: {
                        type: "string",
                        description: "The ID of the template to get",
                    },
                },
                returns: {
                    type: "object",
                    description: "The template",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                        category: { type: "string" },
                        language: { type: "string" },
                        components: { type: "array" },
                    },
                },
            },
            {
                name: "createTemplate",
                description: "Create a new template",
                parameters: {
                    body: {
                        type: "object",
                        description: "The body of the template to create",
                    },
                },
                returns: {
                    type: "object",
                    description: "The created template",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                    },
                    status: { type: "string" },
                    category: { type: "string" },
                    language: { type: "string" },
                    components: { type: "array" },
                    quality_score: { type: "number" },
                    rejected_reason: { type: "string" },
                    last_updated_time: { type: "string" },
                    source: { type: "string" },
                    created_time: { type: "string" },
                    updated_time: { type: "string" },
                    deleted_time: { type: "string" },
                    deleted: { type: "boolean" },
                    deleted_reason: { type: "string" },
                    deleted_reason_code: { type: "string" },
                    deleted_reason_description: { type: "string" },
                },
            },
            {
                name: "updateTemplate",
                description: "Update a template by ID",
                parameters: {
                    templateId: {
                        type: "string",
                        description: "The ID of the template to update",
                    },
                    updates: {
                        type: "object",
                        description: "The updates to the template",
                    },
                },
                returns: {
                    type: "object",
                    description: "The updated template",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                        category: { type: "string" },
                        language: { type: "string" },
                        components: { type: "array" },
                    },
                },
            },
            {
                name: "deleteTemplate",
                description: "Delete a template by ID",
                parameters: {
                    templateId: {
                        type: "string",
                        description: "The ID of the template to delete",
                    },
                },
                returns: {
                    type: "object",
                    description: "The deleted template",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        status: { type: "string" },
                        category: { type: "string" },
                        language: { type: "string" },
                        components: { type: "array" },
                    },
                },
            },
        ];
    }
    _handleError(error) {
        // FIX: Handle case where response is null/undefined (network error)
        const response = error.response;

        if (!response) {
            return this._errorResponse(
                "network_error",
                "Unable to reach Meta authentication servers.",
                503
            );
        }

        const status = response.status;
        const fbError = response.data?.error || {};

        switch (status) {
            case 400:
                return this._errorResponse(
                    this._extractErrorCode(fbError, "invalid_request"),
                    this._extractErrorMessage(fbError, "Bad request."),
                    400
                );
            case 401:
                return this._errorResponse(
                    this._extractErrorCode(fbError, "invalid_token"),
                    this._extractErrorMessage(
                        fbError,
                        "The token is expired or invalid."
                    ),
                    401
                );
            case 403:
                return this._errorResponse(
                    "permission_denied",
                    this._extractErrorMessage(
                        fbError,
                        "Missing required permissions."
                    ),
                    403
                );
            case 429:
                return this._errorResponse(
                    "rate_limit_exceeded",
                    "Too many requests to Meta servers.",
                    429
                );
            default:
                return this._errorResponse(
                    "provider_error",
                    `Meta OAuth error (${status})`,
                    status || 503
                );
        }
    }
}

/**
 * MESSAGING & SETUP APIs (NOT IN OAUTH CLASS)
 *
 * These are separated from OAuth for architectural clarity:
 * - They're not authentication-related
 * - They require config like phoneNumberId, wabaId (not part of OAuth flow)
 * - They're optional operations
 *
 * Files to create:
 * - WhatsAppMessagingAPI: sendText, sendMedia, sendTemplate, etc.
 * - WhatsAppSetupAPI: setupChannel, updateWebhook, etc.
 * - WhatsAppAnalyticsAPI: getAnalytics, getTemplateAnalytics, etc.
 *
 * This separation keeps concerns clean and makes testing easier.
 */

// TODO: Create WhatsAppMessagingAPI class in separate file:
// - sendTextMessage()
// - sendMediaMessage()
// - sendListMessage()
// - sendReplyButtons()
// - sendCtaUrlButton()
// - sendTemplateMessage()
// - And other messaging operations

// TODO: Create WhatsAppSetupAPI class in separate file:
// - setupChannel()
// - updateWebhook()
// - getWebhookSubscriptions()
// - deleteWebhookSubscription()

// TODO: Create WhatsAppTemplateAPI class in separate file:
// - listTemplates()
// - createTemplate()
// - updateTemplate()
// - deleteTemplate()

// TODO: Create WhatsAppPhoneAPI class in separate file:
// - listPhoneNumbers()
// - getPhoneNumber()
// - requestPhoneNumberNameReview()
// - deregisterPhoneNumber()

// TODO: Create WhatsAppProfileAPI class in separate file:
// - getBusinessProfile()
// - updateBusinessProfile()

// TODO: Create WhatsAppMediaAPI class in separate file:
// - uploadMedia()
// - getMediaUrl()
// - downloadMedia()
// - deleteMedia()

// TODO: Create WhatsAppAnalyticsAPI class in separate file:
// - getAnalytics()
// - getTemplateAnalytics()

// TODO: Create WhatsAppAccountAPI class in separate file:
// - getWABADetails()
// - listWABAs()