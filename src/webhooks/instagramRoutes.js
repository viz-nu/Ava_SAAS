import { Router } from "express";
import { parse } from "url";
import { InstagramMessagingAPI, parseWebhook, verifyRequestSignature } from "../utils/instagramHelper.js";
import { getBotDetails } from "../utils/telegraf.js";
import { Conversation } from "../models/Conversations.js";
import { Message } from "../models/Messages.js";
import { Agent, run, RunState, tool } from "@openai/agents";
// import { Channel } from "../models/Channels.js";
import { z } from "zod";
const InstagramBotResponseSchema = z.object({
    type: z.enum(['text', 'quick_reply', 'generic_template', 'button_template', 'media', 'postback']),
    data: z.union([
        // Text message
        z.object({
            text: z.string().max(1000)
        }),

        // Quick reply buttons
        z.object({
            text: z.string().max(640),
            quick_replies: z.array(z.object({
                content_type: z.literal('text'),
                title: z.string().max(20),
                payload: z.string().max(1000)
            })).max(13)
        }),

        // Generic template (carousel)
        z.object({
            elements: z.array(z.object({
                title: z.string().max(80),
                subtitle: z.string().max(80).optional(),
                image_url: z.string().url().optional(),
                buttons: z.array(z.object({
                    type: z.enum(['web_url', 'postback']),
                    title: z.string().max(20),
                    url: z.string().url().optional(),
                    payload: z.string().max(1000).optional()
                })).max(3).optional()
            })).max(10)
        }),

        // Button template
        z.object({
            text: z.string().max(640),
            buttons: z.array(z.object({
                type: z.enum(['web_url', 'postback', 'phone_number']),
                title: z.string().max(20),
                url: z.string().url().optional(),
                payload: z.string().max(1000).optional(),
                phone_number: z.string().optional()
            })).max(3)
        }),

        // Media (image, video, audio)
        z.object({
            attachment_type: z.enum(['image', 'video', 'audio', 'file']),
            url: z.string().url(),
            caption: z.string().max(200).optional()
        }),

        // Postback response
        z.object({
            text: z.string().max(1000),
            postback_payload: z.string().max(1000)
        })
    ]),

    // Optional metadata
    metadata: z.object({
        user_id: z.string().optional(),
        conversation_id: z.string().optional(),
        timestamp: z.number().optional(),
        requires_followup: z.boolean().optional()
    }).optional()
});
export const InstagramRouter = Router()
async function processUserMessage(message, userMessage, bot, agentDetails) {
    const toolsJson = agentDetails?.actions?.map(ele => tool(createToolWrapper(ele))) || [];
    const extraPrompt = `
RESPONSE FORMAT INSTRUCTIONS:
You must respond with a JSON object that matches the InstagramBotResponseSchema. Choose the appropriate message type based on the user's needs:
1. **TEXT MESSAGE** - For simple text responses:
   {
     "type": "text",
     "data": {
       "text": "Your message here"
     }
   }

2. **QUICK REPLY** - For questions with predefined options (max 13 options):
   {
     "type": "quick_reply",
     "data": {
       "text": "Choose an option:",
       "quick_replies": [
         {"content_type": "text", "title": "Option 1", "payload": "OPTION_1"},
         {"content_type": "text", "title": "Option 2", "payload": "OPTION_2"}
       ]
     }
   }

3. **BUTTON TEMPLATE** - For text with action buttons (max 3 buttons):
   {
     "type": "button_template",
     "data": {
       "text": "What would you like to do?",
       "buttons": [
         {"type": "postback", "title": "Get Info", "payload": "GET_INFO"},
         {"type": "web_url", "title": "Visit Site", "url": "https://example.com"}
       ]
     }
   }

4. **GENERIC TEMPLATE** - For carousel/card layouts (max 10 cards):
   {
     "type": "generic_template",
     "data": {
       "elements": [
         {
           "title": "Card Title",
           "subtitle": "Card description",
           "image_url": "https://example.com/image.jpg",
           "buttons": [
             {"type": "postback", "title": "Select", "payload": "SELECT_ITEM_1"}
           ]
         }
       ]
     }
   }

5. **MEDIA** - For sharing images, videos, or files:
   {
     "type": "media",
     "data": {
       "attachment_type": "image",
       "url": "https://example.com/image.jpg",
       "caption": "Optional caption"
     }
   }

IMPORTANT GUIDELINES:
- Always choose the most appropriate message type for the user's request
- Keep text under limits (text: 1000 chars, quick_reply text: 640 chars, button titles: 20 chars)
- Use quick_replies for simple choices, buttons for actions
- Use generic_template for showcasing multiple items/options
- Include meaningful payloads for tracking user interactions
- Ensure all URLs are valid and accessible
- Consider the user experience - don't overwhelm with too many options

Your response will be parsed and sent directly to Instagram's API, so format must be exact.
`;
    if (agentDetails.collections.length > 0) toolsJson.push(tool(createToolWrapper(knowledgeToolBaker(agentDetails.collections))));
    const agent = new Agent({
        name: agentDetails.personalInfo.name,
        instructions: agentDetails.personalInfo.systemPrompt + extraPrompt,
        model: agentDetails.personalInfo.model,
        toolChoice: 'auto',
        temperature: agentDetails.personalInfo.temperature,
        tools: toolsJson,
        outputType: InstagramBotResponseSchema,
    });
    const { userMessageType, userMessageData } = userMessage
    let state, conversation = await Conversation.findOne({ InstagramChatId: message.senderId });
    if (userMessageType == "text") {
        state = []
        if (conversation) {
            const messages = await Message.find({ conversationId: conversation._id }).sort(-1).limit(8).select("query response");
            state.push(...messages.flatMap(({ query, response }) => {
                const entries = [];
                if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                return entries;
            }));
        } else {
            conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentDetails._id, InstagramChatId: message.senderId, channel: "instagram" });
        }
        state.push({ role: "user", content: [{ type: "input_text", text: userMessageData.text }] });
    }
    // else if (userMessageType == "tool_approval") {
    //     const interruptionId = userMessageData.buttonId.replace(userMessageData.approved ? 'approve_' : 'reject_', '');
    //     state = await RunState.fromString(agent, conversation.state);
    //     const interruption = conversation.pendingInterruptions.find(i => i.id === interruptionId);
    //     if (!interruption) {
    //         await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "❌ Interruption not found. Please try again the same request." });
    //         return;
    //     }
    //     if (userMessageData.approved) {
    //         state.approve(interruption);
    //         await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "✅ Tool approved. Processing..." });
    //     } else {
    //         state.reject(interruption);
    //         await bot.sendMessage("whatsapp", phoneNumber, "text", { text: "❌ Tool rejected. Continuing without this action..." });
    //     }
    //     conversation = await Conversation.findByIdAndUpdate(
    //         conversation._id,
    //         {
    //             $pull: { pendingInterruptions: { id: interruptionId } }, // remove matching interruption
    //             $set: { state: state.toString() } // update the state
    //         }, { new: true });
    // }
    let result = await run(agent, state, {
        stream: false,
        maxTurns: 3,
        // context: `${message.contact.name ? "User Name: " + message.contact.name : ""}\nDate: ${new Date().toDateString()}`
    });
    // if (result.interruptions?.length > 0) {
    //     const interruptionData = result.interruptions.map(interruption => ({ ...interruption, timestamp: new Date(), status: 'pending' }));
    //     conversation = await Conversation.findByIdAndUpdate(conversation._id, { $push: { pendingInterruptions: { $each: interruptionData } }, $set: { state: JSON.stringify(result.state) } }, { new: true });
    //     // Send approval request to user
    //     await sendApprovalRequest(bot, message.from, result.interruptions);
    //     return; // Exit early, wait for user approval
    // }

    // Process final result
    const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    result.rawResponses.forEach((ele) => {
        usage.input_tokens += ele.usage.inputTokens;
        usage.output_tokens += ele.usage.outputTokens;
        usage.total_tokens += ele.usage.totalTokens;
    });
    await Message.create({ business: agentDetails.business._id, query: userMessageData.text, response: JSON.stringify(result.finalOutput), conversationId: conversation._id, responseTokens: { model: agentDetails.personalInfo.model ?? null, usage } });
    const { type, Data } = result.finalOutput;
    await bot.sendMessage(message.senderId, { type, Data });
}


InstagramRouter.get("/main", async (req, res) => {
    try {
        const parsedUrl = parse(req.originalUrl, true);
        const query = parsedUrl.query;
        return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === "LeanOn") ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
    } catch (error) {
        console.error('Error in webhook verification:', error);
        return res.sendStatus(500);
    }
})
// verifyRequestSignature
InstagramRouter.post("/main", async (req, res) => {
    try {
        // console.log("📨 Body:", JSON.stringify(req.body, null, 2));
        const parsedData = parseWebhook(req.body);
        console.log("📨 Parsed Data:", JSON.stringify(parsedData, null, 2));
        // https://developers.facebook.com/docs/instagram-platform/webhooks
        //  📨 Body: {
        //             "object": "instagram",
        //                 "entry": [
        //                     {
        //                         "time": 1752779559264,
        //                         "id": "17841476263120799",
        //                         "messaging": [
        //                             {
        //                                 "sender": {
        //                                     "id": "3667808733353751"
        //                                 },
        //                                 "recipient": {
        //                                     "id": "17841476263120799"
        //                                 },
        //                                 "timestamp": 1752779557528,
        //                                 "message": {
        //                                     "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDc2MjYzMTIwNzk5OjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTg1MTY2NDE4MDgwOTA5MzozMjMzMzA3NTkxNTM1NDMwNzQ0MTgzNzQyNzk3MzQyMzEwNAZDZD",
        //                                     "text": "Hey"
        //                                 }
        //                             }
        //                         ]
        //                     }
        //                 ]
        //         }

        // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
        res.sendStatus(200);
        setImmediate(async () => {
            const { object, messages, postbacks, reactions, mediaShares } = parsedData;
            switch (object) {
                case "instagram":
                    for (const message of messages) {
                        const { type, accountId, senderId, recipientId, timestamp } = message;
                        const { agentDetails, channelDetails } = await getBotDetails({ type: "instagram", botId: accountId });
                        if (!agentDetails) return;
                        let userMessageText
                        switch (type) {
                            case "text":
                                const { messageId, text } = message;
                                const bot = await InstagramMessagingAPI.create({ accessToken: channelDetails.secrets.accessToken, tokenExpiryTime: channelDetails.secrets.refreshAt, instagramId: accountId });
                                await processUserMessage(message, { userMessageType: "text", userMessageData: { text: userMessageText } }, bot, agentDetails);
                                break;

                            default:
                                break;
                        }
                    }
                    break;
                default:
                    console.log(`Unknown object type: ${object}`, parsedData);
                    break;
            }
        })
    } catch (error) {
        console.error('❌ Error in WhatsApp webhook:', error);
        return res.sendStatus(500);
    }
})
