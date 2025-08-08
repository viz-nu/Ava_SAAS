import axios from "axios"
export const sendWAMessage = async ({ token, phone_number_id, messaging_product = "whatsapp", to, type = "text", Data }) => {
    try {
        const whatsappApiUrl = `https://graph.facebook.com/v22.0/${phone_number_id}/messages`;
        // Default payload structure
        let payload = { messaging_product, recipient_type: "individual", to: to };
        // Handle different message types
        switch (type) {
            case "text":
                payload.type = "text";
                payload.text = Data;
                break;
            case "image":
                payload.type = "image";
                payload.image = Data;
                break;
            case "audio":
                payload.type = "audio";
                payload.audio = Data;
                break;
            case "document":
                payload.type = "document";
                payload.document = Data;
                break;
            case "interactive":
                payload.type = "interactive";
                payload.interactive = Data;
                break;
            default:
                break;
        }
        const { data } = await axios.post(whatsappApiUrl, payload, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        // console.log("✅ Message sent successfully:", data);
        return data
    } catch (error) {
        console.error("❌ Error sending WhatsApp message:");
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        return null
    }
}
export const getMediaTranscriptions = async ({ token, mediaId, openAiKey, transcriptionModel = "whisper-1" }) => {
    try {
        const { data } = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const response = await axios.get(data.url, { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'arraybuffer' });
        const formData = new FormData();
        const audioBlob = new Blob([response.data], { type: 'audio/ogg' });
        // Add the file to the form data
        formData.append('file', audioBlob, `audio-${mediaId}.ogg`);
        formData.append('model', transcriptionModel);
        // Send directly to OpenAI Whisper API
        const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, { headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'multipart/form-data' } });
        return transcriptionResponse.data.text;

    } catch (error) {
        console.error("Error occurred while fetching MediaUrl:");
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        return "some audio that cannot be processed"
    }
}



export class WhatsAppBot {
    constructor(accessToken, phoneNumberId) {
        this.accessToken = accessToken;
        this.phoneNumberId = phoneNumberId;
        this.baseURL = 'https://graph.facebook.com/v22.0';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
         * Send a message
         * @param {string} to - Recipient phone number (with country code)
         * @param {string} message - Message text
         * @param {boolean} previewUrl - Show URL preview
         * @returns {Promise<Object>} Response from WhatsApp API
         */

    async sendMessage(messaging_product = "whatsapp", to, type = "text", Data) {
        try {
            let payload = { messaging_product, recipient_type: "individual", to: to };
            switch (type) {
                case "text":
                    payload.type = "text";
                    payload.text = Data;
                    break;
                case "image":
                    payload.type = "image";
                    payload.image = { link: Data.link }; // WhatsApp requires link
                    break;
                case "audio":
                    payload.type = "audio";
                    payload.audio = { link: Data.link };
                    break;
                case "document":
                    payload.type = "document";
                    payload.document = { link: Data.link };
                    break;
                case "interactive":
                    payload.type = "interactive";
                    payload.interactive = Data;
                    break;
                case "template":
                    payload.type = "template";
                    payload.template = Data;
                    break;
                default:
                    throw new Error(`Unsupported message type: ${type}`);
            }
            const { data } = await this.client.post(`/${this.phoneNumberId}/messages`, payload);
            return data
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Mark a message as read
     * @param {string} messageId - Message ID to mark as read
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async markMessageAsRead(messageId) {
        try {
            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Get media URL by media ID
     * @param {string} mediaId - Media ID
     * @returns {Promise<string>} Media URL
     */
    async getMediaUrl(mediaId) {
        try {
            const response = await this.client.get(`/${mediaId}`);
            return response.data.url;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Download media content
     * @param {string} mediaUrl - Media URL from getMediaUrl
     * @returns {Promise<Buffer>} Media content as buffer
     */
    async downloadMedia(mediaUrl) {
        try {
            const response = await axios.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Get business profile information
     * @returns {Promise<Object>} Business profile data
     */
    async getBusinessProfile() {
        try {
            const response = await this.client.get(`/${this.phoneNumberId}`, {
                params: {
                    fields: 'name,category,description,email,websites,profile_picture_url'
                }
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Update business profile
     * @param {Object} profileData - Profile data to update
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async updateBusinessProfile(profileData) {
        try {
            const response = await this.client.post(`/${this.phoneNumberId}`, profileData);
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
 * Parse incoming WhatsApp Business webhook message from Meta
 * @param {Object} webhookData - Webhook payload
 * @returns {Array<Object>} Array of parsed message or status data
 */
    parseWebhookMessage(webhookData) {
        const parsedMessages = [];
        const entries = webhookData?.entry || [];

        for (const entry of entries) {
            const changes = entry?.changes || [];

            for (const change of changes) {
                const value = change?.value;
                if (!value) continue;

                const metadata = value?.metadata || {};
                const contacts = value?.contacts || [];
                const messages = value?.messages || [];
                const statuses = value?.statuses || [];

                // Handle incoming messages
                for (const message of messages) {
                    const contact = contacts.find(c => c.wa_id === message.from) || {};
                    const parsedMessage = {
                        type: 'message',
                        subType: message.type, // text, image, audio, etc.
                        entryId: entry.id || '',
                        phoneNumberId: metadata.phone_number_id || '',
                        messageId: message.id || '',
                        from: message.from || '',
                        timestamp: message.timestamp || '',
                        content: {
                            text: message.text?.body || null,
                            image: message.image || null,
                            document: message.document || null,
                            audio: message.audio || null,
                            video: message.video || null,
                            location: message.location || null,
                            interactive: this.extractInteractive(message),
                            button: message.button || null,
                            list: message.list || null,
                        },
                        contact: {
                            name: contact.profile?.name || '',
                            waId: contact.wa_id || message.from || ''
                        },
                        context: message.context || null,
                        errors: value.errors || null
                    };

                    parsedMessages.push(parsedMessage);
                }

                // Handle delivery/read status updates
                for (const status of statuses) {
                    const statusUpdate = {
                        type: 'status',
                        entryId: entry.id || '',
                        phoneNumberId: metadata.phone_number_id || '',
                        messageId: status.id || '',
                        recipientId: status.recipient_id || '',
                        status: status.status || '',
                        timestamp: status.timestamp || '',
                        errors: status.errors || null
                    };

                    parsedMessages.push(statusUpdate);
                }
            }
        }

        return parsedMessages;

    }
    extractInteractive(message) {
        if (!message.interactive) return null;

        const { type, button_reply, list_reply } = message.interactive;
        return {
            type,
            reply: button_reply || list_reply || null
        };
    }
    /**
     * Handle API errors
     * @private
     */
    _handleError(error) {
        if (error.response) {
            const errorData = error.response.data;
            return new Error(`WhatsApp API Error: ${errorData.error?.message || 'Unknown error'} (Code: ${error.response.status})`);
        } else if (error.request) {
            return new Error('WhatsApp API Error: No response received');
        } else {
            return new Error(`WhatsApp API Error: ${error.message}`);
        }
    }


    /**
     * Send a text message
     * @param {string} to - Recipient phone number (with country code)
     * @param {string} message - Message text
     * @param {boolean} previewUrl - Show URL preview
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendTextMessage(to, message, previewUrl = false) {
        try {
            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: {
                    preview_url: previewUrl,
                    body: message
                }
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Send a template message
     * @param {string} to - Recipient phone number
     * @param {string} templateName - Template name
     * @param {string} languageCode - Language code (e.g., 'en_US')
     * @param {Array} components - Template components/parameters
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendTemplateMessage(to, templateName, languageCode = 'en_US', components = []) {
        try {
            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: {
                        code: languageCode
                    },
                    components: components
                }
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Send an image message
     * @param {string} to - Recipient phone number
     * @param {string} imageUrl - Image URL or media ID
     * @param {string} caption - Optional caption
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendImageMessage(to, imageUrl, caption = '') {
        try {
            const imageData = imageUrl.startsWith('http')
                ? { link: imageUrl }
                : { id: imageUrl };

            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'image',
                image: {
                    ...imageData,
                    caption: caption
                }
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Send a document message
     * @param {string} to - Recipient phone number
     * @param {string} documentUrl - Document URL or media ID
     * @param {string} filename - Document filename
     * @param {string} caption - Optional caption
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendDocumentMessage(to, documentUrl, filename, caption = '') {
        try {
            const documentData = documentUrl.startsWith('http')
                ? { link: documentUrl }
                : { id: documentUrl };

            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'document',
                document: {
                    ...documentData,
                    filename: filename,
                    caption: caption
                }
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Send interactive buttons message
     * @param {string} to - Recipient phone number
     * @param {string} bodyText - Message body text
     * @param {Array} buttons - Array of button objects [{id, title}]
     * @param {string} headerText - Optional header text
     * @param {string} footerText - Optional footer text
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendButtonMessage(to, bodyText, buttons, headerText = '', footerText = '') {
        try {
            const interactive = {
                type: 'button',
                body: { text: bodyText },
                action: {
                    buttons: buttons.map(btn => ({
                        type: 'reply',
                        reply: {
                            id: btn.id,
                            title: btn.title
                        }
                    }))
                }
            };

            if (headerText) interactive.header = { type: 'text', text: headerText };
            if (footerText) interactive.footer = { text: footerText };

            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: interactive
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }

    /**
     * Send interactive list message
     * @param {string} to - Recipient phone number
     * @param {string} bodyText - Message body text
     * @param {string} buttonText - Button text to open list
     * @param {Array} sections - Array of section objects with rows
     * @param {string} headerText - Optional header text
     * @param {string} footerText - Optional footer text
     * @returns {Promise<Object>} Response from WhatsApp API
     */
    async sendListMessage(to, bodyText, buttonText, sections, headerText = '', footerText = '') {
        try {
            const interactive = {
                type: 'list',
                body: { text: bodyText },
                action: {
                    button: buttonText,
                    sections: sections
                }
            };

            if (headerText) interactive.header = { type: 'text', text: headerText };
            if (footerText) interactive.footer = { text: footerText };

            const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'interactive',
                interactive: interactive
            });
            return response.data;
        } catch (error) {
            throw this._handleError(error);
        }
    }


}

// Usage example:
/*


// Send text message
bot.sendTextMessage('1234567890', 'Hello from chatbot!')
    .then(response => console.log('Message sent:', response))
    .catch(error => console.error('Error:', error));

// Mark message as read
bot.markMessageAsRead('MESSAGE_ID')
    .then(response => console.log('Message marked as read:', response))
    .catch(error => console.error('Error:', error));

// Send interactive buttons
bot.sendButtonMessage(
    '1234567890',
    'Choose an option:',
    [
        { id: 'option1', title: 'Option 1' },
        { id: 'option2', title: 'Option 2' }
    ],
    'Menu',
    'Select your choice'
).then(response => console.log('Button message sent:', response));
*/




// Send Messages
// Learn how to use the /messages endpoint to send text, media, location, contact, and interactive messages.

// Send Message Templates
// Send specific message formats to your customers, including reminders, shipping information, and payment updates.

// Mark Messages as Read
// Use the /messages node to change the status of incoming messages to read.

// Sell Products & Services
// Learn how to offer your products and services in WhatsApp messages.

// Migrate From On-Premises API to Cloud API
// Learn how to migrate from On-Premises API to Cloud API.

// Create a Sample App Endpoint for Webhooks Testing
// Use Glitch to create a sample app with an endpoint to test your webhooks.

// Cloud API Monitoring for Outbound Load Testing
// Shows you how to use Cloud API monitoring tools for outbound load testing.