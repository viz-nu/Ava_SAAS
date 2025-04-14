import { Router } from "express";
import { parse } from "url";
import { getMediaTranscriptions, sendWAMessage } from "../utils/WA.js";
import { generateAIResponse } from "../utils/openai.js";
import { Agent } from "../models/Agent.js";
import { Business } from "../models/Business.js";
export const whatsappRouter = Router()
whatsappRouter.get('/:agentId', async (req, res) => {
  try {
    const parsedUrl = parse(req.originalUrl, true);
    const query = parsedUrl.query;
    const agent = await Agent.findById(req.params.agentId);
    return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === agent.integrations.whatsapp.verificationToken) ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.sendStatus(500);
  }
});
whatsappRouter.post('/:agentId', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.agentId);
    const business = await Business.findOne({ agents: agent._id })
    console.log("📨 Body:", JSON.stringify(req.body, null, 2));
    const body = req.body;
    if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
      // Process each entry in the webhook
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Get the value object which contains all the important data
            const value = change.value;
            const phone_number_id = value.metadata.phone_number_id
            const messaging_product = value.messaging_product
            // Check if this is a message notification
            if (value.messages && Array.isArray(value.messages)) {
              // Process each message
              for (const message of value.messages) {
                const from = message.from;
                // Extract contact name from the contacts array
                let contactName = null;
                if (value.contacts && Array.isArray(value.contacts)) {
                  // Find the contact that matches the sender
                  const contact = value.contacts.find(c => c.wa_id === from);
                  if (contact && contact.profile && contact.profile.name) {
                    contactName = contact.profile.name;
                    console.log(`👤 Contact identified: ${contactName} (${from})`);
                  }
                }
                // Handle different message types
                let userMessageText = "";
                switch (message.type) {
                  case "text":
                    userMessageText = message.text.body;
                    console.log(`💬 Text message from ${contactName || from}: "${userMessageText}"`);
                    break;
                  case "image":
                    userMessageText = message.image.caption || "Image received (no caption)";
                    console.log(`📸 Image message from ${contactName || from}: "${userMessageText}"`);
                    break;
                  case "audio":
                    userMessageText = await getMediaTranscriptions({ token: agent.integrations?.whatsapp?.permanentAccessToken, mediaId: message.audio.id, transcriptionModel: "whisper-1" });
                    console.log(`🔊 Audio message from ${contactName || from}`);
                    break;
                  case "document":
                    userMessageText = message.document.caption || "Document received (no caption)";
                    console.log(`📄 Document message from ${contactName || from}: "${userMessageText}"`);
                    break;
                  default:
                    userMessageText = `Message of type ${message.type} received`;
                    console.log(`📩 ${message.type} message from ${contactName || from}`);
                    break;
                }
                try {
                  // Create a personalized system prompt with the user's name
                  const responseText = await generateAIResponse({ userMessageText, contactName })
                  console.log(`🤖 AI Response to ${contactName || from}: "${responseText}"`);
                  // Send the AI response back to the user
                  await sendWAMessage({ token: agent.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "text", Data: { body: responseText } });
                  console.log(`✅ Response sent to ${contactName || from}`);
                } catch (err) {
                  console.error(`❌ Error processing message from ${contactName || from}:`, err);
                }
              }
            }
            // Handle status updates if present
            if (value.statuses && Array.isArray(value.statuses)) {
              value.statuses.forEach(status => {
                console.log(`📈 Status update for message ${status.id}: ${status.status}`);
                console.log(`👤 Recipient: ${status.recipient_id}`);
                console.log(`🕒 Timestamp: ${status.timestamp}`);
              });
            }
          }
        }
      }
    }
    // Always acknowledge receipt to avoid retries
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Error in WhatsApp webhook:', error);
    return res.sendStatus(500);
  }
});
