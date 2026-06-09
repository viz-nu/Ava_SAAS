import axios from "axios";

const API_VERSION = "v23.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const APP_ID = process.env.wa_client_id;
const APP_SECRET = process.env.wa_client_secret;
const APP_TOKEN = `${APP_ID}|${APP_SECRET}`; // app access token, NOT a customer token

// Every field your app needs. `calls` is the one that unlocks Step 2's webhook.
const REQUIRED_FIELDS = [
    "messages",
    "calls",
    "account_update",
    "account_settings_update",
    "message_template_status_update",
];

export async function ensureWhatsAppWebhookSubscription() {
    try {
        // 1) Read what's currently subscribed (idempotency check)
        const { data } = await axios.get(`${BASE_URL}/${APP_ID}/subscriptions`, {
            params: { access_token: APP_TOKEN },
        });

        const waba = (data?.data || []).find(s => s.object === "whatsapp_business_account");
        // fields can come back as ["messages"] or [{name:"messages"}] depending on version
        const current = new Set(
            (waba?.fields || []).map(f => (typeof f === "string" ? f : f.name))
        );
        const missing = REQUIRED_FIELDS.filter(f => !current.has(f));

        if (waba && missing.length === 0) {
            console.log("[bootstrap] webhook fields already complete:", [...current]);
            return { ok: true, changed: false, fields: [...current] };
        }

        // 2) Merge (never drop fields you already had) and write
        const merged = [...new Set([...current, ...REQUIRED_FIELDS])];
        await axios.post(`${BASE_URL}/${APP_ID}/subscriptions`, null, {
            params: {
                object: "whatsapp_business_account",
                callback_url: process.env.WA_APP_CALLBACK_URL, // app-level default endpoint
                verify_token: process.env.WA_APP_VERIFY_TOKEN,
                fields: merged.join(","),
                access_token: APP_TOKEN,
            },
        });

        console.log("[bootstrap] webhook fields set:", merged);
        return { ok: true, changed: true, fields: merged };
    } catch (error) {
        const fb = error?.response?.data?.error || {};
        console.error("[bootstrap] failed", {
            status: error?.response?.status,
            code: fb.code,
            message: fb.message || error.message,
            fbtrace_id: fb.fbtrace_id,
        });
        return { ok: false, error: fb.message || error.message };
    }
}