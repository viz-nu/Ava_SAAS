import { Router } from "express";
import { parse } from "url";
import { getMediaTranscriptions, sendWAMessage } from "../utils/WA.js";
import { actions, AssistantResponse, generateAIResponse, getContextMain } from "../utils/openai.js";
import { AgentModel } from "../models/Agent.js";
import { Conversation } from "../models/Conversations.js";
import { Message } from "../models/Messages.js";
import { buildFollowUpButtons, createToolWrapper, extractMainAndFollowUps } from "../utils/tools.js";
import { Agent, run, tool } from "@openai/agents";
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
        const agentDetails = await AgentModel.findById(req.params.agentId);
        if (!agentDetails || !agentDetails.integrations?.whatsapp?.permanentAccessToken) return;
        if (!body.object === 'whatsapp_business_account' || !Array.isArray(body.entry)) return;
        for (const entry of body.entry) {
          if (!entry.changes || !Array.isArray(entry.changes)) continue;
          for (const { value } of entry.changes) {
            const phone_number_id = value.metadata.phone_number_id
            const messaging_product = value.messaging_product
            let notificationType = ""
            if (value.statuses && Array.isArray(value.statuses)) notificationType = "Message Update"
            else if (value.messages && Array.isArray(value.messages)) notificationType = "Incoming Message"
            switch (notificationType) {
              case "Message Update":
                value.statuses.forEach(status => {
                  console.log(`📈 Status update for message ${status.id}: ${status.status}`);  //sent,delivered,read
                  console.log(`👤 Recipient: ${status.recipient_id}`);
                  console.log(`🕒 Timestamp: ${status.timestamp}`);
                });
                break;
              case "Incoming Message":
                for (const message of value.messages) {
                  const from = message.from; // => imp
                  await sendWAMessage({ token: agentDetails.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "sender_action", Data: null });
                  let contactName = null;
                  if (value.contacts && Array.isArray(value.contacts)) {
                    const { profile } = value.contacts.find(c => c.wa_id === from); // Find the contact that matches the sender
                    if (profile?.name) contactName = contact.profile.name;  // console.log(`👤 Contact identified: ${contactName} (${from})`);  👤 Contact identified: Viz (919490123143)
                  }
                  // Handle different message types
                  let userMessageText = ""; // => imp
                  switch (message.type) {
                    case "text":
                      userMessageText = message.text.body;
                      // console.log(`💬 Text message from ${contactName || from}: "${userMessageText}"`); 💬 Text message from Viz: "hi..."
                      break;
                    case "image":
                      userMessageText = message.image.caption || "Image received (no caption)";
                      console.log(`📸 Image message from ${contactName || from}: "${userMessageText}"`);
                      break;
                    case "audio":
                      userMessageText = await getMediaTranscriptions({ token: agentDetails.integrations?.whatsapp?.permanentAccessToken, mediaId: message.audio.id, transcriptionModel: "whisper-1" });
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
                      { $setOnInsert: { agent: agentDetails._id, business: agentDetails.business }, ...(contactName ? { contact: { from, contactName } } : {}) },
                      { upsert: true, new: true, strict: false }
                    );
                    let prevMessages = [], state
                    const messages = await Message.find({ conversationId: conversation._id }).select("query response").sort({ createdAt: -1 }).limit(8);
                    prevMessages.push(...messages.flatMap(({ query, response }) => {
                      const entries = [];
                      if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                      if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                      return entries;
                    }));
                    prevMessages.push({ role: "user", content: [{ type: "input_text", text: userMessageText }] });
                    const toolsJson = agentDetails.tools?.map(ele => (tool(createToolWrapper(ele)))) || [];
                    const agent = new Agent({ name: agentDetails.personalInfo.name, instructions: agentDetails.personalInfo.systemPrompt, model: agentDetails.personalInfo.model, toolChoice: 'auto', temperature: agentDetails.personalInfo.temperature, tools: toolsJson });
                    state = prevMessages
                    let { finalOutput } = await run(agent, state, { stream: false, maxTurns: 3, context: `User Name: ${contactName || 'Unknown'}\nDate: ${new Date().toDateString()}` });
                    const message = await Message.create({ business: agentDetails.business, query: userMessageText, response: finalOutput, conversationId: conversation._id });
                    console.log("response", finalOutput);
                    const { mainText, followUps } = extractMainAndFollowUps(finalOutput)
                    console.log({ mainText, followUps });
                    if (mainText.trim()) await sendWAMessage({ token: agentDetails.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "text", Data: { body: mainText } });
                    if (followUps.length > 0) await sendWAMessage({ token: agentDetails.integrations?.whatsapp?.permanentAccessToken, phone_number_id, messaging_product, to: from, type: "interactive", Data: buildFollowUpButtons(followUps) });
                    // const { mainText, followups } = parseLLMResponse(response)
                    // const buttons = followups.map((q) => [q]); // each row = one button
                    // const responseText = await generateAIResponse({ userMessageText, contactName })
                    // console.log(`🤖 AI Response to ${contactName || from}: "${responseText}"`);
                  } catch (err) {
                    console.error(`❌ Error processing message from ${contactName || from}:`, err);
                  }
                }
                break;
              default:
                break;

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
