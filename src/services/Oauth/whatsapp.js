import axios from "axios";
const { wa_client_id, wa_client_secret, wa_redirect_uri, wa_config_id } = process.env;


const API_VERSION = "v23.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function authHeaders(accessToken) {
    return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}



export default {
    name: "whatsapp",
    getConfig() {
        return { clientId: wa_client_id, clientSecret: wa_client_secret };
    },
    getAuthUrl({ state = "", scopes = [] }) {
        const params = new URLSearchParams({ client_id: wa_client_id, redirect_uri: wa_redirect_uri, config_id: wa_config_id, response_type: "code", scope: scopes.join(","), state });
        return `https://www.facebook.com/v23.0/dialog/oauth?${params}`;
    },
    async getTokens({ code }) {
        if (!code || typeof code !== "string") return { success: false, tokenError: { code: "missing_code", message: "A code string is required.", status: 400 } };
        try {
            const shortLivedToken = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", { params: { code, client_id: wa_client_id, client_secret: wa_client_secret } }).then(res => {
                console.log("whatsapp short lived token:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting short lived token", err);
                return null;
            });
            const longLivedToken = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", { params: { grant_type: "fb_exchange_token", client_id: wa_client_id, client_secret: wa_client_secret, fb_exchange_token: shortLivedToken.access_token } }).then(res => {
                console.log("whatsapp long lived token:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting long lived token", err);
                return null;
            });
            const grantedScopes = await axios.get("https://graph.facebook.com/v23.0/me/permissions", { params: { access_token: longLivedToken.access_token } }).then(res => {
                console.log("whatsapp granted scopes:", JSON.stringify(res.data, null, 2));
                return res.data;
            }).catch(err => {
                console.error("error getting granted scopes", err);
                return null;
            });
            const scope = grantedScopes?.data?.filter(item => item.status === "granted")?.map(item => item.permission) || [];

            const { data: accountDetails } = await axios.get("https://graph.facebook.com/v23.0/me", {
                params: {
                    fields: "id,name,first_name,last_name,middle_name,name_format,picture,short_name",
                },
                headers: { Authorization: `Bearer ${longLivedToken.access_token}` },
            });
            return {
                success: true,
                credentials: {
                    accessToken: longLivedToken.access_token,
                    expiresAt: null,
                    tokenType: longLivedToken.token_type
                },
                accountDetails,
                config: this.getConfig(),
                scope
            };
        } catch (error) {
            return { success: false, tokenError: this._handleWhatsAppError(error) };
        }
    },
    async setupChannel({ apiAuthenticator, providerName, channelId, config }) {
        const API_VERSION = 'v23.0';
        const { phone_number_id, waba_id, business_id } = config;
        config.webhookUrl = `${process.env.WEBHOOKS_URL}webhook/${providerName}/${channelId}`;
        config.verificationToken = `LeanOn_${channelId}`;
        config.phoneNumberPin = Math.floor(Math.random() * 900000) + 100000;
        const { expiresAt, accessToken, tokenType } = apiAuthenticator.credentials;
        if (!accessToken || !tokenType) return { success: false, error: { code: "missing_credentials", message: "Missing credentials.", status: 400 } };
        if (expiresAt && expiresAt < Date.now()) {
            const { success, data } = await this.refreshToken(accessToken);
            if (!success) return { success: false, error: data };
            apiAuthenticator.credentials.accessToken = data.access_token;
            apiAuthenticator.credentials.expiresAt = data.expires_in ? new Date(Date.now() + (data.expires_in * 1000)) : null;
            apiAuthenticator.credentials.tokenType = data.token_type;
            await apiAuthenticator.save();
        }
        try {
            console.log("settingUp webhooks")
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`, { "override_callback_uri": config.webhookUrl, "verify_token": config.verificationToken }, { headers: { 'Authorization': `Bearer ${accessToken}` } }).then(res => {
                console.log("webhook set", res.data);
            }).catch(err => {
                console.error("error setting webhook", err);
            });
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`, { 'messaging_product': 'whatsapp', 'pin': config.phoneNumberPin }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` } }).then(res => {
                console.log("phone number registered", res.data);
            }).catch(err => {
                console.error("error registering phone number", err);
            });
            return { success: true, config };
        } catch (error) {
            console.error("error setting up whatsapp channel", error);
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async refreshToken(accessToken) {
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.facebook.com/v23.0/oauth/access_token", {
                params: {
                    grant_type: "fb_exchange_token",
                    client_id: wa_client_id,
                    client_secret: wa_client_secret,
                    fb_exchange_token: accessToken,
                },
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async getUserInfo({ accessToken }) {
        // Returns the user identity and all WhatsApp Business Accounts (WABAs)
        // they have access to. Store waba.id and phone_numbers[].id from here.
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const { data } = await axios.get("https://graph.facebook.com/v23.0/me", {
                params: {
                    fields: "id,name",
                },
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!data) return { success: false, error: { code: "malformed_response", message: "Invalid response from Meta.", status: 502 } };

            // Fetch the WABAs this user has access to so callers can store them
            const wabaRes = await axios.get(`https://graph.facebook.com/v23.0/${data.id}/businesses`, {
                params: { fields: "id,name,whatsapp_business_accounts{id,name,timezone_id,message_template_namespace}" },
                headers: { Authorization: `Bearer ${accessToken}` },
            }).catch(() => ({ data: null }));

            return {
                success: true,
                data: {
                    ...data,
                    businesses: wabaRes.data?.data || [],
                },
            };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async getTokenInfo({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") return { success: false, error: { code: "missing_token", message: "An access token string is required.", status: 400 } };
        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get("https://graph.facebook.com/v23.0/debug_token", {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
            });
            console.log("tokeninfo:", data);
            const tokenData = data?.data;
            return (!tokenData)
                ? { success: false, error: { code: "malformed_response", message: "Invalid response from Meta.", status: 502 } }
                : {
                    success: true,
                    data: {
                        clientId: tokenData.app_id,
                        scopes: tokenData.scopes || [],
                        expiresIn: tokenData.expires_at ? tokenData.expires_at - Math.floor(Date.now() / 1000) : null,
                        isValid: tokenData.is_valid,
                        type: tokenData.type,
                    },
                };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },
    async validateToken({ accessToken }) {
        if (!accessToken || typeof accessToken !== "string") return false;
        try {
            const appAccessToken = `${wa_client_id}|${wa_client_secret}`;
            const { data } = await axios.get("https://graph.facebook.com/v23.0/debug_token", {
                params: {
                    input_token: accessToken,
                    access_token: appAccessToken,
                },
            });
            return data?.data?.is_valid === true;
        } catch (error) {
            return false;
        }
    },



    /** ----------------------------
     *  Messaging — Text & Rich Media
     * -----------------------------*/

    // Send a plain text message
    async sendTextMessage({ accessToken, phoneNumberId, to, body, previewUrl = false }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "text",
                text: { preview_url: previewUrl, body },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Send an image, video, audio, document, or sticker message
    // mediaType: "image" | "video" | "audio" | "document" | "sticker"
    async sendMediaMessage({ accessToken, phoneNumberId, to, mediaType, mediaId, link, caption, filename }) {
        try {
            const mediaPayload = {};
            if (mediaId) mediaPayload.id = mediaId;
            else if (link) mediaPayload.link = link;
            if (caption) mediaPayload.caption = caption;
            if (filename) mediaPayload.filename = filename; // for documents only
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: mediaType,
                [mediaType]: mediaPayload,
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Send a location pin
    async sendLocationMessage({ accessToken, phoneNumberId, to, latitude, longitude, name, address }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "location",
                location: { latitude, longitude, name, address },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Send a contact card
    async sendContactMessage({ accessToken, phoneNumberId, to, contacts }) {
        // contacts: array of contact objects per the WhatsApp API spec
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "contacts",
                contacts,
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // React to a message with an emoji
    async sendReaction({ accessToken, phoneNumberId, to, messageId, emoji }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "reaction",
                reaction: { message_id: messageId, emoji },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Mark an incoming message as read
    async markMessageAsRead({ accessToken, phoneNumberId, messageId }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId,
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Messaging — Interactive
     * -----------------------------*/

    // Send a list message (menu of up to 10 rows across sections)
    async sendListMessage({ accessToken, phoneNumberId, to, header, body, footer, buttonLabel, sections }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "interactive",
                interactive: {
                    type: "list",
                    ...(header && { header: { type: "text", text: header } }),
                    body: { text: body },
                    ...(footer && { footer: { text: footer } }),
                    action: { button: buttonLabel, sections },
                },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Send reply buttons (up to 3 quick-reply buttons)
    async sendReplyButtons({ accessToken, phoneNumberId, to, body, footer, buttons }) {
        // buttons: [{ id: "btn_1", title: "Yes" }, ...]
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "interactive",
                interactive: {
                    type: "button",
                    body: { text: body },
                    ...(footer && { footer: { text: footer } }),
                    action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
                },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Send a CTA URL button
    async sendCtaUrlButton({ accessToken, phoneNumberId, to, body, buttonText, url }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "interactive",
                interactive: {
                    type: "cta_url",
                    body: { text: body },
                    action: { name: "cta_url", parameters: { display_text: buttonText, url } },
                },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Messaging — Templates
     * -----------------------------*/

    // Send a pre-approved template message
    async sendTemplateMessage({ accessToken, phoneNumberId, to, templateName, languageCode = "en_US", components = [] }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/messages`, {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to,
                type: "template",
                template: { name: templateName, language: { code: languageCode }, components },
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Message Templates — CRUD
     * -----------------------------*/

    // List all message templates for a WABA
    async listTemplates({ accessToken, wabaId, fields = "name,status,category,language,components", limit = 20 }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${wabaId}/message_templates`, {
                params: { fields, limit },
                headers: authHeaders(accessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Create a new message template
    async createTemplate({ accessToken, wabaId, name, category, language, components, allowCategoryChange = false }) {
        // category: "AUTHENTICATION" | "MARKETING" | "UTILITY"
        try {
            const { data } = await axios.post(`${BASE_URL}/${wabaId}/message_templates`, {
                name, category, language, components,
                ...(allowCategoryChange && { allow_category_change: true }),
            }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Edit an existing template (only REJECTED or PAUSED templates can be fully edited;
    // APPROVED templates allow limited component edits)
    async updateTemplate({ accessToken, templateId, components }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${templateId}`, { components }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Delete a template by name (deletes all language variants)
    async deleteTemplate({ accessToken, wabaId, templateName, templateId }) {
        try {
            const { data } = await axios.delete(`${BASE_URL}/${wabaId}/message_templates`, {
                params: { name: templateName, ...(templateId && { hsm_id: templateId }) },
                headers: authHeaders(accessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Phone Numbers
     * -----------------------------*/

    // List all phone numbers registered under a WABA
    async listPhoneNumbers({ accessToken, wabaId, fields = "id,display_phone_number,verified_name,quality_rating,platform_type,throughput,status" }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${wabaId}/phone_numbers`, {
                params: { fields },
                headers: authHeaders(accessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Get details of a single phone number
    async getPhoneNumber({ accessToken, phoneNumberId, fields = "id,display_phone_number,verified_name,quality_rating,platform_type,throughput,status,name_status,new_name_status,decision,requested_verified_name,rejection_reason" }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${phoneNumberId}`, {
                params: { fields },
                headers: authHeaders(accessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Request a display name change for a phone number
    async requestPhoneNumberNameReview({ accessToken, phoneNumberId, verifiedName }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}`, { verified_name: verifiedName }, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Deregister a phone number from the WhatsApp Business API
    async deregisterPhoneNumber({ accessToken, phoneNumberId }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/deregister`, {}, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Business Profile
     * -----------------------------*/

    // Get the public business profile shown to WhatsApp users
    async getBusinessProfile({ accessToken, phoneNumberId, fields = "about,address,description,email,profile_picture_url,websites,vertical" }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${phoneNumberId}/whatsapp_business_profile`, {
                params: { fields },
                headers: authHeaders(accessToken),
            });
            return { success: true, data: data?.data?.[0] || data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Update the business profile (about, address, description, email, websites, vertical)
    async updateBusinessProfile({ accessToken, phoneNumberId, profile }) {
        // profile: { about, address, description, email, websites: [], vertical }
        try {
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/whatsapp_business_profile`,
                { messaging_product: "whatsapp", ...profile },
                { headers: authHeaders(accessToken) }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Media
     * -----------------------------*/

    // Upload media to Meta's servers — returns a reusable media_id
    async uploadMedia({ accessToken, phoneNumberId, fileBuffer, mimeType, filename }) {
        try {
            const FormData = (await import("form-data")).default;
            const form = new FormData();
            form.append("messaging_product", "whatsapp");
            form.append("type", mimeType);
            form.append("file", fileBuffer, { contentType: mimeType, filename });
            const { data } = await axios.post(`${BASE_URL}/${phoneNumberId}/media`, form, {
                headers: { ...form.getHeaders(), Authorization: `Bearer ${accessToken}` },
            });
            return { success: true, data }; // data.id is the media_id
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Get metadata (url, mime_type, file_size) for an uploaded media object
    async getMediaUrl({ accessToken, mediaId }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${mediaId}`, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Download media content by URL (use the URL returned by getMediaUrl)
    async downloadMedia({ accessToken, mediaUrl }) {
        try {
            const response = await axios.get(mediaUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
                responseType: "arraybuffer",
            });
            return { success: true, buffer: response.data, contentType: response.headers["content-type"] };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Delete an uploaded media object
    async deleteMedia({ accessToken, mediaId }) {
        try {
            const { data } = await axios.delete(`${BASE_URL}/${mediaId}`, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Analytics & Insights
     * -----------------------------*/

    // Retrieve per-template or per-phone analytics (sent, delivered, read counts)
    async getAnalytics({ accessToken, wabaId, startDate, endDate, granularity = "DAILY", phoneNumbers = [], templateIds = [] }) {
        // startDate / endDate: Unix timestamps (seconds)
        // granularity: "HALF_HOUR" | "DAY" | "MONTH"
        try {
            const params = {
                fields: `analytics.start(${startDate}).end(${endDate}).granularity(${granularity})${phoneNumbers.length ? `.phone_numbers(${JSON.stringify(phoneNumbers)})` : ""}{sent,delivered,read,failed_delivery_count}`,
            };
            const { data } = await axios.get(`${BASE_URL}/${wabaId}`, { params, headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Get per-template conversation analytics
    async getTemplateAnalytics({ accessToken, wabaId, startDate, endDate, templateIds = [] }) {
        try {
            const templateFilter = templateIds.length ? `.template_ids(${JSON.stringify(templateIds)})` : "";
            const params = {
                fields: `template_analytics.start(${startDate}).end(${endDate})${templateFilter}{template_id,status,category,sent,delivered,read,clicked}`,
            };
            const { data } = await axios.get(`${BASE_URL}/${wabaId}`, { params, headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  WABA Account
     * -----------------------------*/

    // Fetch WhatsApp Business Account details
    async getWABADetails({ accessToken, wabaId, fields = "id,name,currency,timezone_id,message_template_namespace,account_review_status,ban_state,business_verification_status" }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${wabaId}`, { params: { fields }, headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // List all WABAs the access token has access to, under a Business portfolio
    async listWABAs({ accessToken, businessId, fields = "id,name,timezone_id,message_template_namespace" }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${businessId}/owned_whatsapp_business_accounts`, {
                params: { fields },
                headers: authHeaders(accessToken),
            });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    /** ----------------------------
     *  Webhooks
     * -----------------------------*/

    // List current webhook subscriptions for a WABA
    async getWebhookSubscriptions({ accessToken, wabaId }) {
        try {
            const { data } = await axios.get(`${BASE_URL}/${wabaId}/subscribed_apps`, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Update (or re-point) the webhook URL for a WABA
    async updateWebhook({ accessToken, wabaId, webhookUrl, verifyToken }) {
        try {
            const { data } = await axios.post(`${BASE_URL}/${wabaId}/subscribed_apps`,
                { override_callback_uri: webhookUrl, verify_token: verifyToken },
                { headers: authHeaders(accessToken) }
            );
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },

    // Unsubscribe the app from WABA webhooks
    async deleteWebhookSubscription({ accessToken, wabaId }) {
        try {
            const { data } = await axios.delete(`${BASE_URL}/${wabaId}/subscribed_apps`, { headers: authHeaders(accessToken) });
            return { success: true, data };
        } catch (error) {
            return { success: false, error: this._handleWhatsAppError(error) };
        }
    },


    _handleWhatsAppError(error) {
        const response = error.response;
        const fbError = response?.data?.error;
        switch (response?.status) {
            case 400: return { code: fbError?.code || "invalid_request", message: fbError?.message || "Bad request.", status: 400 };
            case 401: return { code: fbError?.type || "invalid_token", message: fbError?.message || "The token is expired or invalid.", status: 401 };
            case 429: return { code: "rate_limit_exceeded", message: "Too many requests to Meta servers.", status: 429 };
            default: {
                console.error(error)
                return { code: "provider_error", message: "Unable to reach Meta authentication servers.", status: response?.status || 503 };
            }
        }
    },
};