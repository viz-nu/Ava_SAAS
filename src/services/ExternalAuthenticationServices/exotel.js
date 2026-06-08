import axios from "axios";
import { BaseOAuthProvider } from "./base.js";
const SUBDOMAIN_MAP = {
    singapore: "api.exotel.com",       // my.exotel.com accounts
    mumbai: "api.in.exotel.com",       // my.mum1.exotel.com accounts
};

function buildBaseUrl(subdomain) {
    return `https://${subdomain}`;
}

function basicAuth(apiKey, apiToken) {
    return `Basic ${Buffer.from(`${apiKey}:${apiToken}`).toString("base64")}`;
}

export default class OauthExotel extends BaseOAuthProvider {
    name = "exotel";

    getConfig() {
        return {};
    }

    // Exotel has no OAuth — credentials are static (apiKey + apiToken + accountSid + subdomain).
    // getAuthUrl is not applicable; the UI should collect these four fields directly.
    getAuthUrl({ state = "" }) {
        return {
            AuthUrl: `https://www.avakado.ai/integrate/exotel?state=${state}`, ExpectedKeysFromQuery: {
                type: "object",
                required: ["apiKey", "apiToken", "accountSid", "region"],
                properties: {
                    apiKey: {
                        type: "string",
                        description: "Exotel API Key"
                    },
                    apiToken: {
                        type: "string",
                        description: "Exotel API Token"
                    },
                    accountSid: {
                        type: "string",
                        description: "Exotel Account SID"
                    },
                    region: {
                        type: "string",
                        description: "Exotel Region",
                        default: "singapore",
                        enum: ["singapore", "mumbai"]
                    }
                },
                additionalProperties: false
            }
        };
    }

    // Validates the credentials by hitting a lightweight Exotel endpoint.
    // ExpectedKeysFromQuery: ['apiKey', 'apiToken', 'accountSid', 'region']
    // region: 'singapore' | 'mumbai'  (defaults to 'singapore')
    async getTokens({ apiKey, apiToken, accountSid, region = "singapore" }) {
        if (!apiKey || !apiToken || !accountSid) {
            return this._errorResponse("missing_credentials", "apiKey, apiToken, and accountSid are required.", 400);
        }
        const subdomain = SUBDOMAIN_MAP[region] || SUBDOMAIN_MAP.singapore;
        try {
            // Lightweight validation: list calls (empty is fine, 200 = credentials valid)
            const { data: accountDetails } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return this._successResponse({ apiKey, apiToken, accountSid, subdomain }, { accountDetails, config: {}, scope: [] });

        } catch (error) {
            return this._handleError(error);
        }
    }

    // Sets up inbound call/SMS webhook for the given Exotel virtual number (exophone).
    // config must include: { exophone }  — the DID/Exophone to attach the webhook to
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`;
        const { apiKey, apiToken, accountSid, subdomain } = apiAuthenticator.credentials;
        const { exophone } = config;

        if (!exophone) return this._errorResponse("missing_exophone", "config.exophone (DID number) is required.", 400);

        try {
            // Exotel doesn't have a single "register webhook" REST endpoint.
            // Webhooks are configured per-call via StatusCallback in the call API,
            // OR globally per Exophone via the integrations app_setting API.
            // We register the popup/callback URL via the integrations core endpoint.
            const integrationsBase = `https://integrationscore.mum1.exotel.com/v2/integrations`;
            const authCode = basicAuth(apiKey, apiToken);

            // Set inbound call handler (popup) webhook
            await axios.post(`${integrationsBase}/app_setting`,
                { Key: "popup", Value: webhookUrl },
                { headers: { Authorization: authCode, "Content-Type": "application/json" } }
            );

            // Set post-call status callback
            await axios.post(`${integrationsBase}/app_setting`,
                { Key: "callback", Value: webhookUrl },
                { headers: { Authorization: authCode, "Content-Type": "application/json" } }
            );

            return this._successResponse({ ...config, webhookUrl, exophone }, { config: { ...config, webhookUrl, exophone }, scope: [] });
        } catch (error) {
            return this._handleError(error);
        }
    }

    async getUserInfo({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) {
            return this._errorResponse("missing_credentials", "apiKey, apiToken, and accountSid are required.", 400);
        }
        try {
            // Fetch account-level info via the Calls list (lightest endpoint that confirms identity)
            const { data } = await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return this._successResponse({ accountSid, subdomain, ...data }, { accountDetails: { accountSid, subdomain, ...data }, config: {}, scope: [] });
        } catch (error) {
            return this._handleError(error);
        }
    }

    async getTokenInfo({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) {
            return this._errorResponse("missing_credentials", "apiKey, apiToken, and accountSid are required.", 400);
        }
        try {
            await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return this._successResponse({ clientId: accountSid, scopes: [], expiresIn: null, isValid: true }, { config: {}, scope: [] });
        } catch (error) {
            return this._handleError(error);
        }
    }

    async validateToken({ apiKey, apiToken, accountSid, subdomain = SUBDOMAIN_MAP.singapore }) {
        if (!apiKey || !apiToken || !accountSid) return false;
        try {
            await axios.get(
                `${buildBaseUrl(subdomain)}/v1/Accounts/${accountSid}/Calls.json?PageSize=1`,
                { headers: { Authorization: basicAuth(apiKey, apiToken) } }
            );
            return true;
        } catch {
            return false;
        }
    }

    _handleError(error) {
        // FIX: Handle case where response is null/undefined (network error)
        const response = error.response;

        if (!response) {
            return this._errorResponse(
                "network_error",
                "Unable to reach Exotel authentication servers.",
                503
            );
        }

        const status = response.status;
        const errorData = response.data || {};

        switch (status) {
            case 400:
                return this._errorResponse(
                    this._extractErrorCode(errorData, "invalid_grant"),
                    this._extractErrorMessage(
                        errorData,
                        "The token is invalid or has already been used. For OAuth 2.1 refresh token rotation, this means the refresh token was already consumed."
                    ),
                    400
                );
            case 401:
                return this._errorResponse(
                    "unauthorized",
                    "Access token is expired or invalid.",
                    401
                );
            case 403:
                return this._errorResponse(
                    "forbidden",
                    "Insufficient permissions or missing required scopes.",
                    403
                );
            case 429:
                return this._errorResponse(
                    "rate_limit_exceeded",
                    "Too many requests. Respect the Retry-After header before retrying.",
                    429
                );
            default:
                return this._errorResponse(
                    "provider_error",
                    `Exotel error (${status})`,
                    status || 503
                );
        }
    }
};