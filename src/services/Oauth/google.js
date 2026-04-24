import axios from "axios";
import jwt from "jsonwebtoken";
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
export default {
    name: "google",
    getConfig() {
        return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI }
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent", state, });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async getTokens(code) {
        if (!code || typeof code !== 'string') return { success: false, error: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const { data } = await axios.post("https://oauth2.googleapis.com/token", { code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: GOOGLE_REDIRECT_URI, grant_type: "authorization_code" });
            //  googleTokens :{
            //     "access_token": "...access_token...",
            //     "expires_in": "...expires_in number...",
            //     "refresh_token": "...refresh_token...",
            //     "scope": "...scope string...",
            //     "token_type": "Bearer",
            //     "id_token": "...id_token string...", // this is the id token that is used to get the user info
            //     "refresh_token_expires_in": "...refresh_token_expires_in number...",
            // }
            const credentials = { tokenId: data.id_token, accessToken: data.access_token, expiresAt: new Date(Date.now() + (data.expires_in * 1000)), refreshToken: data.refresh_token, tokenType: data.token_type, refreshTokenExpiresAt: data.refresh_token_expires_in ? new Date(Date.now() + (data.refresh_token_expires_in * 1000)) : null }
            const scope = data.scope.split(" ")
            const decoded = jwt.decode(data.id_token);
            const accountDetails = decoded ? { ...decoded, id: decoded.sub } : null;
            // {
            //     iss: '...issuer string...',
            //     azp: '..client id string...',
            //     aud: '..client id string...',
            //     sub: '..id string...',
            //     email: '..email string...',
            //     email_verified: '...boolean...',
            //     at_hash: '...at_hash string...',
            //     name: '...name string...',
            //     picture: '...picture string...',
            //     given_name: '...given_name string...',
            //     family_name: '...family_name string...',
            //     iat: '...iat number...',
            //     exp: '...exp number...'
            //   }
            return { success: true, credentials, scope, accountDetails, config: this.getConfig() };
        } catch (error) {
            return { success: false, tokenError: this._handleGoogleError(error) };
        }
    },
    async refreshToken({ refreshToken }) {
        if (!refreshToken || typeof refreshToken !== 'string') return { success: false, error: { code: "missing_token", message: "A refresh token string is required.", status: 400 } };
        try {
            const { data } = await axios.post("https://oauth2.googleapis.com/token", { client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" });
            return { success: true, data: { tokenId: data.id_token, accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: new Date(Date.now() + (data.expires_in * 1000)), tokenType: data.token_type, refreshTokenExpiresAt: data.refresh_token_expires_in } };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async getUserInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://www.googleapis.com/oauth2/v1/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, });
            return (!data) ? { success: false, error: { code: "malformed_response", message: "Invalid response from Google.", status: 502 } } : { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async getTokenInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo`, { params: { access_token: accessToken }, timeout: 5000, });
            console.log("tokeninfo:", data);
            return (!data) ? { success: false, error: { code: "malformed_response", message: "Invalid response from Google.", status: 502 } } : { success: true, data: { clientId: data.azp, scopes: data.scope?.split(" ") || [], expiresIn: parseInt(data.expires_in), email: data.email, isValid: true } };
        } catch (error) {
            return { success: false, error: this._handleGoogleError(error) };
        }
    },
    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== 'string') return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get(`https://oauth2.googleapis.com/tokeninfo`, { params: { access_token: accessToken }, timeout: 5000, });
            return true;
        } catch (error) {
            return false;
        }
    },
    _handleGoogleError(error) {
        const response = error.response;
        switch (response?.status) {
            case 400: return { code: response.data?.error || "invalid_token", message: response.data?.error_description || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Google validation servers.", status: 429 };
            default: return { code: "provider_error", message: "Unable to reach Google authentication servers.", status: response?.status || 503 };
        }
    }
};