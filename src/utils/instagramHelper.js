import axios from "axios"
import crypto from "crypto"
export class InstagramMessagingAPI {
    constructor() {
        this.accessToken = "";
        this.appSecret = "";
        this.verifyToken = "";
        this.instagramId = "";
        this.baseUrl = 'https://graph.instagram.com/v23.0';
        this.apiVersion = config.apiVersion || 'v23.0';
    }

    // Send text message
    async sendTextMessage(recipientId, text) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: { text: text }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send text message: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send image message
    async sendImageMessage(recipientId, imageUrl) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'image',
                            payload: { url: imageUrl }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send image message: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send video message
    async sendVideoMessage(recipientId, videoUrl) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'video',
                            payload: { url: videoUrl }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send video message: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send audio message
    async sendAudioMessage(recipientId, audioUrl) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'audio',
                            payload: { url: audioUrl }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send audio message: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send heart sticker
    async sendHeartSticker(recipientId) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'like_heart'
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send heart sticker: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send reaction to a message
    async sendReaction(recipientId, messageId, reaction = 'love') {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    sender_action: 'react',
                    payload: {
                        message_id: messageId,
                        reaction: reaction
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send reaction: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Remove reaction from a message
    async removeReaction(recipientId, messageId) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    sender_action: 'unreact',
                    payload: {
                        message_id: messageId
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to remove reaction: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send media share (Instagram post)
    async sendMediaShare(recipientId, postId) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'MEDIA_SHARE',
                            payload: { id: postId }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send media share: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Send button template message
    async sendButtonTemplate(recipientId, text, buttons) {
        // Validate buttons
        if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > 3) {
            throw new Error('Buttons must be an array with 1-3 button objects');
        }

        // Validate button structure
        buttons.forEach((button, index) => {
            if (!button.type || !button.title) {
                throw new Error(`Button ${index + 1} must have 'type' and 'title' properties`);
            }

            if (button.type === 'web_url' && !button.url) {
                throw new Error(`Button ${index + 1} with type 'web_url' must have 'url' property`);
            }

            if (button.type === 'postback' && !button.payload) {
                throw new Error(`Button ${index + 1} with type 'postback' must have 'payload' property`);
            }
        });

        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: 'template',
                            payload: {
                                template_type: 'button',
                                text: text,
                                buttons: buttons
                            }
                        }
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to send button template: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Helper method to create web URL button
    createWebUrlButton(title, url) {
        return {
            type: 'web_url',
            url: url,
            title: title
        };
    }

    // Helper method to create postback button
    createPostbackButton(title, payload) {
        return {
            type: 'postback',
            payload: payload,
            title: title
        };
    }

    // Get user profile information
    async getUserProfile(userId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${userId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    params: {
                        fields: 'id,username,account_type,media_count'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get user profile: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Get conversation history
    async getConversation(userId) {
        try {
            const response = await axios.get(
                `${this.baseUrl}/${this.instagramId}/conversations`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    params: {
                        platform: 'instagram',
                        user_id: userId
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get conversation: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Mark message as read
    async markAsRead(messageId) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/${this.instagramId}/messages`,
                {
                    message_id: messageId,
                    sender_action: 'mark_seen'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Failed to mark message as read: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Handle webhook events with parsing
    handleWebhook(req, res, callbacks = {}) {
        const body = req.body;

        // Verify webhook signature
        const signature = req.headers['x-hub-signature-256'];
        if (!this.verifyWebhookSignature(JSON.stringify(body), signature)) {
            console.error('Invalid webhook signature');
            return res.sendStatus(403);
        }

        // Parse webhook data
        const parsedData = this.parseWebhook(body);

        // Handle different event types
        if (parsedData.messages.length > 0 && callbacks.onMessage) {
            parsedData.messages.forEach(message => {
                callbacks.onMessage(message);
            });
        }

        if (parsedData.postbacks.length > 0 && callbacks.onPostback) {
            parsedData.postbacks.forEach(postback => {
                callbacks.onPostback(postback);
            });
        }

        if (parsedData.reactions.length > 0 && callbacks.onReaction) {
            parsedData.reactions.forEach(reaction => {
                callbacks.onReaction(reaction);
            });
        }

        if (parsedData.mediaShares.length > 0 && callbacks.onMediaShare) {
            parsedData.mediaShares.forEach(share => {
                callbacks.onMediaShare(share);
            });
        }

        res.sendStatus(200);
    }
}
export const verifyRequestSignature = (req, res, buf) => {
    var signature = req.headers["x-hub-signature-256"];

    if (!signature) {
        console.warn(`Couldn't find "x-hub-signature-256" in headers.`);
    } else {
        var elements = signature.split("=");
        var signatureHash = elements[1];
        var expectedHash = crypto.createHmac("sha256", config.appSecret).update(buf).digest("hex");
        if (signatureHash != expectedHash) throw new Error("Couldn't validate the request signature.");
    }
}
export const parseWebhook = (webhookData) => {

    const { object, entry } = webhookData;
    const parsedData = {
        object,
        messages: [],
        postbacks: [],
        reactions: [],
        mediaShares: []
    };
    if (entry && Array.isArray(entry) && entry.length > 0) {

        entry.forEach(entry => {
            const { id, time, messaging } = entry;


            if (messaging) {
                messaging.forEach(event => {
                    const { sender, recipient, timestamp, message } = event;
                    const accountId = id;
                    const senderId = sender.id;
                    const recipientId = recipient.id;
                    // mid text.quick_reply.reply_to attachments referral


                    // https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/messages#quick_reply



                    // Parse text messages
                    if (message.text) parsedData.messages.push({ type: 'text', accountId, senderId, recipientId, timestamp, messageId: message.mid, text: message.text });
                    // Parse attachments (images, videos, audio)
                    if (message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0) message.attachments.forEach(attachment => { parsedData.mediaShares.push({ type: 'attachment', senderId, recipientId, timestamp, messageId: message.mid, attachmentType: attachment.type, url: attachment.payload.url }); });
                    // Parse postbacks (button clicks)
                    if (event.postback) parsedData.postbacks.push({ type: "postback", accountId, senderId, recipientId, timestamp, payload: event.postback.payload, title: event.postback.title });
                    // Parse reactions
                    if (event.reaction) parsedData.reactions.push({ type: "reaction", accountId, senderId, recipientId, timestamp, messageId: event.reaction.mid, reaction: event.reaction.reaction, action: event.reaction.action  /*'react' or 'unreact'*/ });
                });
            }
        });
    }

    return parsedData;
}