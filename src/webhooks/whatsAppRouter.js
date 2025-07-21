import { Router } from "express";
import { parse } from "url";
import { getMediaTranscriptions, WhatsAppBot } from "../utils/WA.js";
import { Conversation } from "../models/Conversations.js";
import { Message } from "../models/Messages.js";
import { createToolWrapper, knowledgeToolBaker } from "../utils/tools.js";
import { Agent, run, RunState, tool } from "@openai/agents";
import { Channel } from "../models/Channels.js";
import { getBotDetails } from "../utils/telegraf.js";
import { z } from "zod";
import "dotenv/config.js";
export const whatsappRouter = Router()
export const WhatsAppBotResponseSchema = z.object({
  message: z.string()
    .min(1, "Message cannot be empty")
    .max(1024, "Message must be 1024 characters or less"),
  buttons: z.array(
    z.object({
      id: z.string()
        .min(1, "Button ID cannot be empty")
        .max(256, "Button ID must be 256 characters or less")
        .regex(/^[a-zA-Z0-9_-]+$/, "Button ID can only contain letters, numbers, underscores, and hyphens"),
      text: z.string()
        .min(1, "Button text cannot be empty")
        .max(20, "Button text must be 20 characters or less")
        .refine((text) => text.trim().length > 0, "Button text cannot be only whitespace")
    })
  ).max(3, "WhatsApp allows maximum 3 buttons")
    .nullable() // allow missing buttons for plain text
});
async function processUserMessage(message, userMessage, bot, agentDetails) {
  const toolsJson = agentDetails?.actions?.map(ele => tool(createToolWrapper(ele))) || [];
  const extraPrompt = `
  If max turns are exceeded, provide a concise summary or polite closing message.

  Always return a JSON object that follows this schema:
  {
    "message": string,        // The main reply text to send
    "buttons": [              // Optional array of interactive buttons
      {
        "id": string,         // Unique identifier for the button
        "text": string        // The button label shown to the user
      }
    ] OR null if there are no buttons
  }

  Rules:
  - If there are no buttons, set "buttons" to null (not an empty array).
  - Keep the message short and conversational.
  - Buttons should be relevant actions based on the user's query.
  - Do NOT include any fields other than "message" and "buttons".
  - Respond in a helpful and professional tone.
  Example response:
  {
    "message": "What would you like to do next?",
      "buttons": [
        { "id": "order_status", "text": "Check Order Status" },
        { "id": "new_order", "text": "Place a New Order" }
      ]
  }`;
  if (agentDetails.collections.length > 0) toolsJson.push(tool(createToolWrapper(knowledgeToolBaker(agentDetails.collections))));
  const agent = new Agent({
    name: agentDetails.personalInfo.name,
    instructions: agentDetails.personalInfo.systemPrompt + extraPrompt,
    model: agentDetails.personalInfo.model,
    toolChoice: 'auto',
    temperature: agentDetails.personalInfo.temperature,
    tools: toolsJson,
    outputType: WhatsAppBotResponseSchema,
  });
  const { userMessageType, userMessageData } = userMessage
  let state, conversation = await Conversation.findOne({ whatsappChatId: message.from });
  if (userMessageType == "text") {
    state = []
    if (conversation) {
      const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).limit(8).select("query response");
      state.push(...messages.flatMap(({ query, response }) => {
        const entries = [];
        if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
        if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
        return entries;
      }));
    } else {
      conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentDetails._id, whatsappChatId: message.from, channel: "whatsapp" });
    }
    state.push({ role: "user", content: [{ type: "input_text", text: userMessageData.text }] });
  }
  else if (userMessageType == "tool_approval") {
    const interruptionId = userMessageData.buttonId.replace(userMessageData.approved ? 'approve_' : 'reject_', '');
    state = await RunState.fromString(agent, conversation.state);
    const interruption = conversation.pendingInterruptions.find(i => i.id === interruptionId);
    if (!interruption) {
      await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "❌ Interruption not found. Please try again the same request." });
      return;
    }
    if (userMessageData.approved) {
      state.approve(interruption);
      await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "✅ Tool approved. Processing..." });
    } else {
      state.reject(interruption);
      await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "❌ Tool rejected. Continuing without this action..." });
    }
    conversation = await Conversation.findByIdAndUpdate(
      conversation._id,
      {
        $pull: { pendingInterruptions: { id: interruptionId } }, // remove matching interruption
        $set: { state: state.toString() } // update the state
      }, { new: true });
  }
  let result = await run(agent, state, {
    stream: false,
    maxTurns: 3,
    context: `${message.contact.name ? "User Name: " + message.contact.name : ""}\nDate: ${new Date().toDateString()}`
  });
  if (result.interruptions?.length > 0) {
    const interruptionData = result.interruptions.map(interruption => ({ ...interruption, timestamp: new Date(), status: 'pending' }));
    conversation = await Conversation.findByIdAndUpdate(conversation._id, { $push: { pendingInterruptions: { $each: interruptionData } }, $set: { state: JSON.stringify(result.state) } }, { new: true });
    // Send approval request to user
    await sendApprovalRequest(bot, message.from, result.interruptions);
    return; // Exit early, wait for user approval
  }

  // Process final result
  const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  result.rawResponses.forEach((ele) => {
    usage.input_tokens += ele.usage.inputTokens;
    usage.output_tokens += ele.usage.outputTokens;
    usage.total_tokens += ele.usage.totalTokens;
  });
  await Message.create({
    business: agentDetails.business._id,
    query: userMessageData.text,
    response: JSON.stringify(result.finalOutput),
    conversationId: conversation._id,
    responseTokens: { model: agentDetails.personalInfo.model ?? null, usage }
  });
  const { type, Data } = mapToWhatsAppPayload(result.finalOutput);
  await bot.sendMessage("whatsapp", message.from, type, Data);
}
function mapToWhatsAppPayload(finalOutput) {
  const { message, buttons } = finalOutput;
  if (!buttons || buttons.length === 0) {
    return {
      type: "text",
      Data: { body: message }
    };
  }
  return {
    type: "interactive",
    Data: {
      type: "button",
      body: { text: message },
      action: {
        buttons: buttons
          .slice(0, 3) // WhatsApp allows max 3 buttons
          .map((b, i) => ({
            type: "reply",
            reply: {
              id: (b.id || `btn_${i + 1}`).trim(),
              title: (b.text || `Option ${i + 1}`).trim().substring(0, 20)
            }
          }))
      }
    }
  };
}
whatsappRouter.get("/main", async (req, res) => {
  try {
    const parsedUrl = parse(req.originalUrl, true);
    const query = parsedUrl.query;
    return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === "LeanOn") ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.sendStatus(500);
  }
})
whatsappRouter.post("/main", async (req, res) => {
  try {
    console.log("📨 Body:", JSON.stringify(req.body, null, 2));
    const body = req.body;
    console.log({ params: req.params })
    //  📨 Body: {
    //    "entry": [
    //      {
    //        "id": "1219503423001950",
    //        "time": 1752478279,
    //        "changes": [
    //          {
    //            "value": {
    //              "event": "PARTNER_ADDED",
    //              "waba_info": {
    //                "waba_id": "1088931445926834",
    //                "owner_business_id": "783945933306941"
    //              }
    //            },
    //            "field": "account_update"
    //          }
    //        ]
    //      }
    //    ],
    //    "object": "whatsapp_business_account"
    //  }

    // 📨 Body: {
    //   "entry": [
    //     {
    //       "id": "1219503423001950",
    //       "time": 1752478288,
    //       "changes": [
    //         {
    //           "value": {
    //             "event": "PARTNER_APP_INSTALLED",
    //             "waba_info": {
    //               "waba_id": "1088931445926834",
    //               "owner_business_id": "783945933306941",
    //               "partner_app_id": "1352067905890307"
    //             }
    //           },
    //           "field": "account_update"
    //         }
    //       ]
    //     }
    //   ],
    //   "object": "whatsapp_business_account"
    // }



    res.status(200).send('EVENT_RECEIVED');

  } catch (error) {
    console.error('❌ Error in WhatsApp webhook:', error);
    return res.sendStatus(500);
  }
})
whatsappRouter.get('/:phone_number_id', async (req, res) => {
  try {
    const parsedUrl = parse(req.originalUrl, true);
    const query = parsedUrl.query;
    const { phone_number_id } = req.params
    const channel = await Channel.findOne({ "config.phone_number_id": phone_number_id })
    return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === channel.secrets.verificationToken) ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.sendStatus(500);
  }
});
whatsappRouter.post('/:phone_number_id', async (req, res) => {
  try {
    const { phone_number_id } = req.params;
    const { agentDetails, channelDetails } = await getBotDetails({ type: "whatsapp", botId: phone_number_id });
    const bot = new WhatsAppBot(channelDetails.secrets.permanentAccessToken, phone_number_id);
    const messages = bot.parseWebhookMessage(req.body);
    res.status(200).send('EVENT_RECEIVED');
    setImmediate(async () => {
      try {
        for (const message of messages) {
          switch (message.type) {
            case "status":
              console.dir(message);
              continue;
            case "message":
              let userMessageText = "";
              switch (message.subType) {
                case "text":
                  userMessageText = message.content.text;
                  break;
                case "image":
                  userMessageText = message.content.image.caption || "Image received (no caption)";
                  console.log(`📸 Image message from ${message.contact.name || message.from}: "${userMessageText}"`);
                  break;
                case "audio":
                  userMessageText = await getMediaTranscriptions({ token: bot.accessToken, mediaId: message.content.audio.id, transcriptionModel: "whisper-1" });
                  console.log(`🔊 Audio message from ${message.contact.name || message.from}`);
                  break;
                case "document":
                  userMessageText = message.content.document.caption || "Document received (no caption)";
                  console.log(`📄 Document message from ${message.contact.name || message.from}: "${userMessageText}"`);
                  break;
                case "button_reply": // ✅ Button clicks from interactive messages
                  userMessageText = `User clicked button: ${message.content.button_reply.title}`;
                  break;
                case "interactive":
                  if (message.content.interactive.reply.id.startsWith('approve_')) {
                    await processUserMessage(message, { userMessageType: "tool_approval", userMessageData: { buttonId: message.content.interactive.reply.id, approved: true } }, bot, agentDetails);
                    continue;
                  } else if (message.content.interactive.reply.id.startsWith('reject_')) {
                    await processUserMessage(message, { userMessageType: "tool_approval", userMessageData: { buttonId: message.content.interactive.reply.id, approved: false } }, bot, agentDetails);
                    continue;
                  }
                  userMessageText = `User clicked button: ${message.content.interactive.reply.title}`;
                  break;
                default:
                  userMessageText = `Message of type ${message.subType} received`;
                  console.log(`📩 ${message.subType} message from ${message.contact.name || message.from}`);
                  break;
              }
              await processUserMessage(message, { userMessageType: "text", userMessageData: { text: userMessageText } }, bot, agentDetails);
              break;
            default:
              console.log("unknown message type:", message.type)
              continue;
              break;
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
async function sendApprovalRequest(bot, phoneNumber, interruptions) {
  for (const interruption of interruptions) {
    const approvalMessage = {
      message: `🔧 Tool Approval Required\n\nAgent "${interruption.agent.name}" wants to use the tool "${interruption.rawItem.name}" with the following parameters:\n\n${interruption.rawItem.arguments}\n\nDo you approve this action?`,
      buttons: [
        {
          id: `approve_${interruption.id}`,
          text: "✅ Approve"
        },
        {
          id: `reject_${interruption.id}`,
          text: "❌ Reject"
        }
      ]
    };
    const { type, Data } = mapToWhatsAppPayload(approvalMessage);
    await bot.sendMessage("whatsapp", phoneNumber, type, Data);
  }
}
whatsappRouter.post("/send-message", async (req, res) => {
  try {
    const { to, phoneNumber_id, Data } = req.body;
    console.log({ to, phoneNumber_id});

    if (!phoneNumber_id) return res.status(400).json({ error: "phoneNumber_id is required" });
    const { channelDetails } = await getBotDetails({ type: "whatsapp", botId: phoneNumber_id });
    const bot = new WhatsAppBot(channelDetails.secrets.permanentAccessToken, phoneNumber_id);
    const response = await bot.sendMessage("whatsapp", to, "text", Data);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});


// {
//   "template": {
//     "name": "event_feedback_request",
//       "language": {
//       "code": "en_US"
//     },
//     "components": [
//       {
//         "type": "header",
//         "parameters": [
//           {
//             "type": "image",
//             "image": {
//               "link": "https://www.jito.org/images/events/jito-event.jpg"
//             }
//           }
//         ]
//       },
//       {
//         "type": "body",
//         "parameters": [
//           {
//             "type": "text",
//             "text": "Hi {{1}}, thank you for attending *Forge Factory - Building JITO Industry for INDIA*! Your feedback is invaluable to us in shaping future events. 🌟"
//           }
//         ]
//       },
//       {
//         "type": "button",
//         "sub_type": "quick_reply",
//         "index": "0",
//         "parameters": [
//           {
//             "type": "payload",
//             "payload": "GIVE_FEEDBACK"
//           }
//         ]
//       },
//       {
//         "type": "button",
//         "sub_type": "quick_reply",
//         "index": "1",
//         "parameters": [
//           {
//             "type": "payload",
//             "payload": "LATER"
//           }
//         ]
//       }
//     ]
//   }
// }


// 0|Ava_SAAS  | {
// 0|Ava_SAAS  |   type: 'status',
// 0|Ava_SAAS  |   entryId: '1382037933021228',
// 0|Ava_SAAS  |   phoneNumberId: '751796534676044',
// 0|Ava_SAAS  |   messageId: 'wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSREY4OUEyOUQ1Njg3NEM0QUJCAA==',
// 0|Ava_SAAS  |   recipientId: '919490123143',
// 0|Ava_SAAS  |   status: 'sent',
// 0|Ava_SAAS  |   timestamp: '1752505937',
// 0|Ava_SAAS  |   errors: null
// 0|Ava_SAAS  | }
// 1|Ava_SAAS  | Mon, 14 Jul 2025 15:12:19 GMT POST /webhook/whatsapp/751796534676044 200 14 - 690.244 ms
// 1|Ava_SAAS  | {
// 1|Ava_SAAS  |   type: 'status',
// 1|Ava_SAAS  |   entryId: '1382037933021228',
// 1|Ava_SAAS  |   phoneNumberId: '751796534676044',
// 1|Ava_SAAS  |   messageId: 'wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSREY4OUEyOUQ1Njg3NEM0QUJCAA==',
// 1|Ava_SAAS  |   recipientId: '919490123143',
// 1|Ava_SAAS  |   status: 'read',
// 1|Ava_SAAS  |   timestamp: '1752505938',
// 1|Ava_SAAS  |   errors: null
// 1|Ava_SAAS  | }
// 1|Ava_SAAS  | Mon, 14 Jul 2025 15:12:19 GMT POST /webhook/whatsapp/751796534676044 200 14 - 679.076 ms
// 1|Ava_SAAS  | {
// 1|Ava_SAAS  |   type: 'status',
// 1|Ava_SAAS  |   entryId: '1382037933021228',
// 1|Ava_SAAS  |   phoneNumberId: '751796534676044',
// 1|Ava_SAAS  |   messageId: 'wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSREY4OUEyOUQ1Njg3NEM0QUJCAA==',
// 1|Ava_SAAS  |   recipientId: '919490123143',
// 1|Ava_SAAS  |   status: 'delivered',
// 1|Ava_SAAS  |   timestamp: '1752505938',
// 1|Ava_SAAS  |   errors: null
// 1|Ava_SAAS  | }
// 0|Ava_SAAS  | Mon, 14 Jul 2025 15:12:19 GMT POST /webhook/whatsapp/751796534676044 200 14 - 696.207 ms
// 0|Ava_SAAS  | {
// 0|Ava_SAAS  |   type: 'status',
// 0|Ava_SAAS  |   entryId: '1382037933021228',
// 0|Ava_SAAS  |   phoneNumberId: '751796534676044',
// 0|Ava_SAAS  |   messageId: 'wamid.HBgMOTE5NDkwMTIzMTQzFQIAERgSREY4OUEyOUQ1Njg3NEM0QUJCAA==',
// 0|Ava_SAAS  |   recipientId: '919490123143',
// 0|Ava_SAAS  |   status: 'delivered',
// 0|Ava_SAAS  |   timestamp: '1752505938',
// 0|Ava_SAAS  |   errors: null
// 0|Ava_SAAS  | }