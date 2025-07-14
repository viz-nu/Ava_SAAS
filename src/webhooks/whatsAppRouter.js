import { Router } from "express";
import { parse } from "url";
import { getMediaTranscriptions, WhatsAppBot } from "../utils/WA.js";
import { Conversation } from "../models/Conversations.js";
import { Message } from "../models/Messages.js";
import { createToolWrapper } from "../utils/tools.js";
import { Agent, run, tool } from "@openai/agents";
import { Channel } from "../models/Channels.js";
import { getBotDetails } from "../utils/telegraf.js";
export const whatsappRouter = Router()
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
    const { phone_number_id } = req.params
    const { agentDetails, channelDetails } = await getBotDetails({ type: "whatsapp", phone_number_id })
    const bot = new WhatsAppBot(channelDetails.secrets.permanentAccessToken, phone_number_id)
    let messages = bot.parseWebhookMessage(req.body)
    res.status(200).send('EVENT_RECEIVED');
    setImmediate(async (agentDetails, channelDetails, messages) => {
      try {
        for (const message of messages) {
          switch (message.type) {
            case "status":
              console.dir(message);
              break;
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
                default:
                  userMessageText = `Message of type ${message.subType} received`;
                  console.log(`📩 ${message.subType} message from ${message.contact.name || message.from}`);
                  break;
              }
              const conversation = await Conversation.findOne({ whatsappChatId: message.from })
              let prevMessages = [], state
              if (conversation) {
                const messages = await Message.find({ conversationId: conversation._id }).limit(8).select("query response");
                prevMessages.push(...messages.flatMap(({ query, response }) => {
                  const entries = [];
                  if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                  if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                  return entries;
                }));
              } else { conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentDetails._id, whatsappChatId: message.from, channel: "whatsapp" }); }
              prevMessages.push({ role: "user", content: [{ type: "input_text", text: userMessageText }] });
              const toolsJson = agentDetails?.actions?.map(ele => tool(createToolWrapper(ele))) || [];
              const agent = new Agent({
                name: agentDetails.personalInfo.name,
                instructions: agentDetails.personalInfo.systemPrompt,
                model: agentDetails.personalInfo.model,
                toolChoice: 'auto',
                temperature: agentDetails.personalInfo.temperature,
                tools: toolsJson,
              });
              state = prevMessages
              const result = await run(agent, state, { stream: false, maxTurns: 3, context: `${message.contact.name ? "User Name: " + message.contact.name : ""}\nDate: ${new Date().toDateString()}` })
              const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
              result.rawResponses.forEach((ele) => { usage.input_tokens += ele.usage.inputTokens, usage.output_tokens += ele.usage.outputTokens, usage.total_tokens += ele.usage.totalTokens })
              await Message.create({ business: agentDetails.business._id, query: userMessageText, response: result.finalOutput, conversationId: conversation._id, responseTokens: { model: agentDetails.personalInfo.model ?? null, usage } });
              await bot.sendMessage(messaging_product = "whatsapp", to = message.from, type = "text", Data, { body: result.finalOutput });
              break;
            default:
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