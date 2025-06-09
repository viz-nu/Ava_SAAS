import { Router } from "express";
import { parse } from "url";
import { getMediaTranscriptions, sendWAMessage } from "../utils/WA.js";
import { actions, AssistantResponse, generateAIResponse, getContextMain } from "../utils/openai.js";
import { AgentModel } from "../models/Agent.js";
import { Conversation } from "../models/Conversations.js";
import { Message } from "../models/Messages.js";
export const whatsappRouter = Router()
whatsappRouter.get('/:agentId', async (req, res) => {
  try {
    const parsedUrl = parse(req.originalUrl, true);
    const query = parsedUrl.query;
    const agent = await AgentModel.findById(req.params.agentId);
    return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === agent.integrations.whatsapp.verificationToken) ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.sendStatus(500);
  }
});
whatsappRouter.post('/:agentId', async (req, res) => {
  try {
    // console.log("📨 Body:", JSON.stringify(req.body, null, 2));
    const body = req.body;
    res.status(200).send('EVENT_RECEIVED');
    setImmediate(async (params) => {
      try {
        const agent = await AgentModel.findById(req.params.agentId);
        if (!agent || !agent.integrations?.whatsapp?.permanentAccessToken) return;
        if (body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
          for (const entry of body.entry) {
            if (entry.changes && Array.isArray(entry.changes)) {
              for (const { value } of entry.changes) {
                // Get the value object which contains all the important data
                const phone_number_id = value.metadata.phone_number_id
                const messaging_product = value.messaging_product
                // Check if this is a message notification
                if (value.messages && Array.isArray(value.messages)) {
                  // Process each message
                  for (const message of value.messages) {
                    const from = message.from; // => imp
                    // Extract contact name from the contacts array
                    let contactName = null;
                    if (value.contacts && Array.isArray(value.contacts)) {
                      // Find the contact that matches the sender
                      const contact = value.contacts.find(c => c.wa_id === from);
                      if (contact && contact.profile && contact.profile.name) {
                        contactName = contact.profile.name; // => imp
                        // console.log(`👤 Contact identified: ${contactName} (${from})`);
                        // 👤 Contact identified: Viz (919490123143)
                      }
                    }
                    // Handle different message types
                    let userMessageText = ""; // => imp
                    switch (message.type) {
                      case "text":
                        userMessageText = message.text.body;
                        // console.log(`💬 Text message from ${contactName || from}: "${userMessageText}"`);
                        //  💬 Text message from Viz: "hi..."
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
                      const conversation = await Conversation.findOneAndUpdate(
                        { whatsappChatId: from, createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
                        { $setOnInsert: { agent: agent._id, business: agent.business }, ...(contactName ? { contact: { from, contactName } } : {}) },
                        { upsert: true, new: true, strict: false }
                      );
                      let prevMessages = []
                      const messages = await Message.find({ conversationId: conversation._id }).select("query response").sort({ createdAt: -1 }).limit(8);
                      prevMessages.push(...messages.flatMap(({ query, response }) => {
                        const entries = [];
                        if (query) entries.push({ role: "user", content: query });
                        if (response) entries.push({ role: "assistant", content: response });
                        return entries;
                      }));
                      let listOfIntentions = [{
                        "intent": "enquiry",
                        "dataSchema": [{
                          "key": "Topic",
                          "type": "dynamic",
                          "dataType": "string",
                          "required": true,
                          "comments": "General information requests. The subject of the enquiry (e.g., services, products, policies).",
                          "validator": "",
                          "data": "",
                          "userDefined": true
                        }]
                      },
                      {
                        "intent": "general_chat", "dataSchema": [{
                          "key": "Message",
                          "type": "dynamic",
                          "dataType": "string",
                          "required": true,
                          "comments": "A general conversational message from the user.",
                          "validator": "",
                          "data": "",
                          "userDefined": true
                        }]
                      }]
                      listOfIntentions.push(...agent.actions.filter(action => action.intentType === "Query").map(({ intent, workingData }) => ({ intent, dataSchema: workingData.body })));
                      const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions)
                      const message = await Message.create({ business: agent.business, query: userMessageText, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
                      for (const { intent, dataSchema, confidence } of matchedActions) {
                        if (intent == "enquiry") {
                          const { data = text } = dataSchema.find(ele => ele.key == "Topic") || {}
                          const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
                          let config = {
                            additional_instructions: `Today:${new Date()} \n Context: ${answer || null}
                                    **DATA COMPLETENESS PROTOCOL - CRITICAL:**
                                    When you do not have enough information to provide a complete and accurate answer to ANY query, you MUST begin your response with exactly "DATAPOINT_NEXUS" followed by your regular response. This applies to:
                                    - Any specific information not included in the context provided
                                    - Questions where context is missing, incomplete, or unclear
                                    - Requests for details that would require additional data
                                    - Any query where you cannot give a confident and complete answer
                                    Example:
                                        User: "What is the history of..."
                                        Your response: "DATAPOINT_NEXUS Hello! I don't have specific information about the history you're asking about. However, I can tell you that... [continue with what you do know]"`,
                            assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, signalKeyword: "DATAPOINT_NEXUS", streamOption: false
                          }
                          const { responseTokens, response, signalDetected } = await AssistantResponse(req, res, config)
                          // const { mainText, followups } = parseLLMResponse(response)
                          // const buttons = followups.map((q) => [q]); // each row = one button
                          await sendWAMessage({ token: agent.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "text", Data: { body: response } });
                          message.responseTokens = responseTokens
                          message.response = response
                          message.embeddingTokens = embeddingTokens
                          message.context = context
                          if (signalDetected && agent.personalInfo.noDataMail) {
                            try {
                              console.log("sending mail", { to: agent.personalInfo.noDataMail, topic: data });
                              let text = `Dear [Support Team],
                    While interacting with the chatbot, it failed to fetch content related to "${data}". This issue is affecting the user experience and needs immediate attention.
                    Please investigate and resolve the issue as soon as possible.
                    Best regards,
                                        Team Avakado`
                              let html = `<!DOCTYPE html>
                    <html>
                    <head>
                    <meta charset="UTF-8">
                    <title>Chatbot Content Fetch Issue</title>
                    <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        padding: 20px;
                        }
                    .container {
                    background: #ffffff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    h2 {
                        color: #d9534f;
                    }
                    p {
                        color: #333;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #777;
                    }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                    <p>Dear <strong>Support Team</strong>,</p>
                    <p>While interacting with the chatbot, it failed to retrieve content related to <strong>${data}</strong>. This issue is impacting the user experience and requires immediate attention.</p>
                    <p>Please investigate and resolve the issue as soon as possible.</p>
                    <p>Best regards,</p>
                    <p><strong>Team Avakado</strong><br>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply directly.</p>
                    </div>
                    </div>
                    </body>
                                        </html>`
                              await sendMail({ to: agent.personalInfo.noDataMail, subject: "Urgent: Missing information for AVA", text, html })
                            } catch (error) {
                              console.error(error);
                            }
                          }
                        }
                        else if (intent == "general_chat") {
                          let config = { assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, streamOption: false }
                          const { responseTokens, response } = await AssistantResponse(req, res, config)
                          // const { mainText, followups } = parseLLMResponse(response)
                          // const buttons = followups.map((q) => [q]); // each row = one button        
                          await sendWAMessage({ token: agent.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "text", Data: { body: response } });
                          message.responseTokens = responseTokens
                          message.response = response
                        }
                        else {
                          await sendWAMessage({ token: agent.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "text", Data: { body: "Action supposed to fire" } });
                        }
                      }
                      await message.save()
                      // const responseText = await generateAIResponse({ userMessageText, contactName })
                      // console.log(`🤖 AI Response to ${contactName || from}: "${responseText}"`);
                    } catch (err) {
                      console.error(`❌ Error processing message from ${contactName || from}:`, err);
                    }
                  }
                }
                // Handle status updates if present
                if (value.statuses && Array.isArray(value.statuses)) {
                  value.statuses.forEach(status => {
                    console.log(`📈 Status update for message ${status.id}: ${status.status}`);  //sent,delivered,read
                    console.log(`👤 Recipient: ${status.recipient_id}`);
                    console.log(`🕒 Timestamp: ${status.timestamp}`);
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Processing error:", error);
      }
    })
  } catch (error) {
    console.error('❌ Error in WhatsApp webhook:', error);
    return res.sendStatus(500);
  }
});
