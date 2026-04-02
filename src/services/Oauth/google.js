import axios from "axios";

export default {
    name: "google",
    getScopes(scopeCategory) {
        const base = ["openid", "profile", "email"];
        switch (scopeCategory) {
            case "gmail.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/gmail.readonly",
                ];

            case "gmail.send":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/gmail.send",
                ];

            case "gmail.full":
                return [
                    ...base,
                    "https://mail.google.com/", // full access (be careful ⚠️)
                ];

            case "drive.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive.readonly",
                ];

            case "drive.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive.file", // recommended minimal write
                ];

            case "drive.full":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/drive",
                ];

            case "sheets.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets.readonly",
                ];

            case "sheets.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets",
                ];

            case "calendar.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar.readonly",
                ];

            case "calendar.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar.events",
                ];

            case "calendar.full":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/calendar",
                ];

            case "forms.read":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/forms.responses.readonly",
                ];

            case "forms.write":
                return [
                    ...base,
                    "https://www.googleapis.com/auth/forms.body",
                ];

            default:
                return [
                    ...base,
                    "https://www.googleapis.com/auth/spreadsheets",
                ];
        }
    },
    getAuthUrl(state, scopeCategory) {
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            response_type: "code",
            scope: this.getScopes(scopeCategory).join(" "),
            access_type: "offline",
            prompt: "consent",
            state,
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },
    async getTokens(code) {
        const res = await axios.post("https://oauth2.googleapis.com/token", {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
        });

        return res.data;
    },
    async refreshToken(refreshToken) {
        const res = await axios.post("https://oauth2.googleapis.com/token", {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        });
        return res.data;
    },
};