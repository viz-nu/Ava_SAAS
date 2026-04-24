import axios from "axios";
export default {
    name: "microsoft",
    getConfig() {
        return {
            clientId: process.env.AzureApplicationClientId,
            clientSecret: process.env.AzureClientSecretValue,
            redirectUri: process.env.AZURE_REDIRECT_URI
        }
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: process.env.AzureApplicationClientId, response_type: "code", redirect_uri: process.env.AZURE_REDIRECT_URI, response_mode: "query", scope: scopes.join(" "), state, prompt: "consent" });
        return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
    },
    async getTokens(code) {
        if (!code || typeof code !== 'string') return { success: false, error: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const { data } = await axios.post(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, code, redirect_uri: process.env.AZURE_REDIRECT_URI, grant_type: "authorization_code", }));
            //  microsoftTokens : {
            //     "scope": "...scope string...",
            //     "token_type": "Bearer",
            //     "expires_in": "...expires_in number...",
            //     "ext_expires_in": 3599,
            // "access_token": "...access_token...",
            //     "refresh_token": "...refresh_token...",
            //     "id_token": "...id_token string...", // this is the id token that is used to get the user info
            // }
            const resp = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${data.access_token}` } });
            const accountDetails = await resp.json();
            //   microsoft user: {
            //     "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users/$entity",
            //     "userPrincipalName": "...userPrincipalName string...",
            //     "id": "...id string...",
            //     "displayName": "...displayName string...",
            //     "surname": "...surname string...",
            //     "givenName": "...givenName string...",
            //     "preferredLanguage": "...preferredLanguage string...",
            //     "mail": "...mail string...",
            //     "mobilePhone": "...mobilePhone string...",
            //     "jobTitle": "...jobTitle string...",
            //     "officeLocation": "...officeLocation string...",
            //     "businessPhones": "...businessPhones array of strings..."
            //   }
            const credentials = { tokenId: data.id_token, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + (data.expires_in * 1000)), tokenType: data.token_type, }
            const scope = data.scope.split(" ")
            return { success: true, credentials, scope, accountDetails, config: this.getConfig() };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },

    async refreshToken({ refreshToken }) {
        if (!refreshToken || typeof refreshToken !== 'string') return { success: false, error: { code: "missing_token", message: "A refresh token string is required.", status: 400 } };
        try {
            const { data } = await axios.post(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, new URLSearchParams({ client_id: process.env.AzureApplicationClientId, client_secret: process.env.AzureClientSecretValue, refresh_token: refreshToken, grant_type: "refresh_token", }));
            const credentials = { tokenId: data.id_token, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + (data.expires_in * 1000)), tokenType: data.token_type }
            return { success: true, credentials };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },
    async getUserInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            console.log("microsoft user info:", JSON.stringify(data, null, 2));
            if (!data || !data.id) return { success: false, error: { code: "malformed_response", message: "Invalid response from Microsoft.", status: 502 } };
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleMicrosoftError(error) };
        }
    },
    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            return true;
        } catch (error) {
            return false;
        }
    },
    _handleMicrosoftError(error) {
        const response = error.response;
        switch (response?.status) {
            case 400: return { code: response.data?.error, message: response.data?.error_description, status: response.status };
            case 401: return { code: "invalid_grant", message: "The refresh token is invalid or expired.", status: 401 };
            case 403: return { code: "insufficient_permissions", message: "The user does not have permission to access the resource.", status: 403 };
            default: return { code: "provider_error", message: "Unable to reach Microsoft authentication servers.", status: response?.status || 503 };
        }
    }
};