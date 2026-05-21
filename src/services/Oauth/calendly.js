import axios from "axios";

const { CALENDLY_CLIENT_ID, CALENDLY_CLIENT_SECRET, CALENDLY_REDIRECT_URI } = process.env;

export default {
    name: "calendly",

    getConfig() {
        return {
            clientId: CALENDLY_CLIENT_ID,
            clientSecret: CALENDLY_CLIENT_SECRET,
            redirectUri: CALENDLY_REDIRECT_URI,
        };
    },

    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({
            client_id: CALENDLY_CLIENT_ID,
            redirect_uri: CALENDLY_REDIRECT_URI,
            response_type: "code",
            ...(scopes.length > 0 && { scope: scopes.join(" ") }),
            ...(state && { state }),
        });
        return `https://auth.calendly.com/oauth/authorize?${params}`;
    },

    async getTokens({ code }) {
        if (!code || typeof code !== "string")
            return {
                success: false,
                tokenError: { code: "missing_code", message: "A code string is required.", status: 400 },
            };

        try {
            const { data } = await axios.post(
                "https://auth.calendly.com/oauth/token",
                new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: CALENDLY_CLIENT_ID,
                    client_secret: CALENDLY_CLIENT_SECRET,
                    redirect_uri: CALENDLY_REDIRECT_URI,
                    code,
                }).toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            // calendlyTokens: {
            //   "access_token":  "...access_token...",
            //   "token_type":    "Bearer",
            //   "expires_in":    7200,          // 2 hours
            //   "refresh_token": "...refresh_token...",  // single-use, rotate on every refresh
            //   "scope":         "...scope string...",
            //   "created_at":    1234567890      // Unix timestamp
            // }

            const credentials = {
                accessToken: data.access_token,
                tokenType: data.token_type,
                expiresAt: new Date(Date.now() + data.expires_in * 1000),
                refreshToken: data.refresh_token,
                // Calendly refresh tokens are single-use (OAuth 2.1 rotation).
                // Always overwrite the stored refresh token with the new one returned
                // from every successful POST /oauth/token call. Never reuse an old one.
                refreshTokenExpiresAt: null, // Calendly refresh tokens don't expire unless used
            };

            const scope = data.scope ? data.scope.split(" ") : [];

            // Calendly has no id_token — fetch user info from /users/me
            const userInfoResult = await this.getUserInfo({ accessToken: data.access_token });
            const accountDetails = userInfoResult.success ? userInfoResult.data : null;
            // accountDetails (from GET /users/me → resource): {
            //   uri:                  "https://api.calendly.com/users/AAAA",
            //   name:                 "Jane Doe",
            //   slug:                 "jane-doe",
            //   email:                "jane@example.com",
            //   scheduling_url:       "https://calendly.com/jane-doe",
            //   timezone:             "America/New_York",
            //   avatar_url:           "https://...",
            //   created_at:           "2021-01-01T00:00:00.000000Z",
            //   updated_at:           "2024-01-01T00:00:00.000000Z",
            //   current_organization: "https://api.calendly.com/organizations/BBBB",
            //   id:                   "AAAA"   // extracted UUID from uri
            // }

            return {
                success: true,
                credentials,
                scope,
                accountDetails,
                config: this.getConfig(),
            };
        } catch (error) {
            return { success: false, tokenError: this._handleCalendlyError(error) };
        }
    },

    async refreshToken({ refreshToken }) {
        if (!refreshToken || typeof refreshToken !== "string")
            return {
                success: false,
                error: { code: "missing_token", message: "A refresh token string is required.", status: 400 },
            };

        try {
            const { data } = await axios.post(
                "https://auth.calendly.com/oauth/token",
                new URLSearchParams({
                    grant_type: "refresh_token",
                    client_id: CALENDLY_CLIENT_ID,
                    client_secret: CALENDLY_CLIENT_SECRET,
                    refresh_token: refreshToken,
                }).toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );

            // IMPORTANT: Calendly uses single-use refresh token rotation (OAuth 2.1).
            // The old refreshToken passed in is now INVALID. Always persist data.refreshToken
            // immediately — do not attempt to reuse the previous value.
            // On 400/401 (invalid_grant), clear tokens and prompt user to re-authorize.
            return {
                success: true,
                data: {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token, // new single-use token — overwrite old one immediately
                    expiresAt: new Date(Date.now() + data.expires_in * 1000),
                    tokenType: data.token_type,
                    refreshTokenExpiresAt: null,
                },
            };
        } catch (error) {
            return { success: false, error: this._handleCalendlyError(error) };
        }
    },

    async getUserInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string")
            return {
                success: false,
                error: { code: "missing_token", message: "An access token string is required.", status: 400 },
            };

        try {
            const { data } = await axios.get("https://api.calendly.com/users/me", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!data?.resource)
                return {
                    success: false,
                    error: { code: "malformed_response", message: "Invalid response from Calendly.", status: 502 },
                };

            const resource = data.resource;
            // Extract UUID from the full URI (e.g. "https://api.calendly.com/users/AAAA" → "AAAA")
            const id = resource.uri?.split("/").pop() ?? null;

            return { success: true, data: { ...resource, id } };
        } catch (error) {
            return { success: false, error: this._handleCalendlyError(error) };
        }
    },

    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") return false;

        try {
            await axios.get("https://api.calendly.com/users/me", {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 5000,
            });
            return true;
        } catch {
            return false;
        }
    },

    async revokeToken({ token }) {
        // Revokes either an access token or a refresh token.
        // Calendly docs: POST https://auth.calendly.com/oauth/revoke
        if (!token || typeof token !== "string")
            return {
                success: false,
                error: { code: "missing_token", message: "A token string is required.", status: 400 },
            };

        try {
            await axios.post(
                "https://auth.calendly.com/oauth/revoke",
                new URLSearchParams({
                    client_id: CALENDLY_CLIENT_ID,
                    client_secret: CALENDLY_CLIENT_SECRET,
                    token,
                }).toString(),
                { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
            );
            return { success: true };
        } catch (error) {
            return { success: false, error: this._handleCalendlyError(error) };
        }
    },

    _handleCalendlyError(error) {
        const response = error.response;
        const errorCode = response?.data?.error || response?.data?.title;

        switch (response?.status) {
            case 400:
                // "invalid_grant" = refresh token already used, expired, or revoked
                return {
                    code: errorCode || "invalid_grant",
                    message: response.data?.error_description || response.data?.message || "The token is invalid or has already been used.",
                    status: 400,
                };
            case 401:
                return {
                    code: errorCode || "unauthorized",
                    message: response.data?.message || "Access token is expired or invalid.",
                    status: 401,
                };
            case 403:
                return {
                    code: "forbidden",
                    message: response.data?.message || "Insufficient permissions or missing required scopes.",
                    status: 403,
                };
            case 429:
                return {
                    code: "rate_limit_exceeded",
                    message: "Too many requests. Respect the Retry-After header before retrying.",
                    status: 429,
                };
            default:
                return {
                    code: "provider_error",
                    message: "Unable to reach Calendly authentication servers.",
                    status: response?.status || 503,
                };
        }
    },
};