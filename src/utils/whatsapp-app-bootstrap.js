import axios from "axios";
import FormData from 'form-data';
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
export async function uploadFileToWhatsApp(fileStream, mimeType, filename, platformMeta) {
    try {
        const { accessToken, phone_number_id } = platformMeta;
        const uploadUrl = `${BASE_URL}/${phone_number_id}/media`;

        // Create FormData
        const form = new FormData();
        form.append('file', fileStream, {
            filename: filename,
            contentType: mimeType,
        });
        form.append('type', mimeType);
        form.append('messaging_product', 'whatsapp');


        // Make request to WhatsApp Cloud API
        const response = await axios.post(uploadUrl, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${accessToken}`,
            },
            timeout: 60000,
        });

        // WhatsApp returns: { id: "wamid.xxx" }
        if (!response.data.id) {
            throw new Error('No media ID returned from WhatsApp');
        }

        return response.data;

    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        throw new Error(`WhatsApp upload failed: ${errorMsg}`);
    }

}