import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { generateAIResponse } from "../utils/openai.js";
import { Conversation } from "../models/Conversations.js";
import axios from "axios";
import { getLocation } from "../utils/tools.js";
export const telegramRouter = Router()
telegramRouter.post('/:botId', async (req, res) => {
    try {
        const botId = req.params.botId;
        const { update } = req.body;
        console.log("update", JSON.stringify(update, null, 2));
        
        const chatId = update?.message?.chat?.id;
        const { latitude, longitude } = update?.message?.location;
        const { phone_number, first_name, user_id } = update?.message?.contact;
        const { text } = update?.message;
        const agent = await getBotDetails(botId);
        const conversation = await Conversation.findOneAndUpdate(
            { telegramChatId: chatId },
            { $setOnInsert: { agent: agent._id, business: agent.business }, ...(latitude && longitude ? { geoLocation: await getLocation(latitude, longitude) } : {}), ...(phone_number && first_name && user_id ? { contact: { phone_number, first_name, user_id } } : {}) },
            { upsert: true, new: true }
        );
        console.log("agent", JSON.stringify(agent, null, 2));
        console.log("conversation", JSON.stringify(conversation, null, 2));
        const needLocation = !conversation.geoLocation && !latitude && !longitude;
        const needContact = !conversation.contact && !(phone_number && first_name && user_id);
        const bot = new Telegraf(agent.personalInfo.telegram.botToken);
        await bot.telegram.sendChatAction(chatId, 'typing');
        if (needLocation || needContact) {
            const row = [];
            if (needLocation) row.push({ text: "📍 Share Location", request_location: true });
            if (needContact) row.push({ text: "📞 Share Contact", request_contact: true });
            const text = `To assist you better, please share your ${needLocation ? "location" : ""}${needLocation && needContact ? " and " : ""}${needContact ? "contact details" : ""}.`
            const options = {
                reply_markup: {
                    keyboard: [row],// Single row with both buttons
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
                // message_thread_id?: number | undefined;
                // parse_mode?: ParseMode | undefined;
                // entities?: MessageEntity[] | undefined;
                // link_preview_options?: LinkPreviewOptions | undefined;
                // disable_notification?: boolean | undefined;
                // protect_content?: boolean | undefined;
                // reply_parameters?: ReplyParameters | undefined;
                // reply_markup?: (InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply) | undefined;
            }
            await bot.telegram.sendMessage(chatId, text, options)
        }
        // Handle text messages
        if (text) {
            const aiResponse = await generateAIResponse(text, "A helpful assistant");
            await bot.telegram.sendMessage(chatId, aiResponse, {
                // message_thread_id?: number | undefined;
                // parse_mode?: ParseMode | undefined;
                // entities?: MessageEntity[] | undefined;
                // link_preview_options?: LinkPreviewOptions | undefined;
                // disable_notification?: boolean | undefined;
                // protect_content?: boolean | undefined;
                // reply_parameters?: ReplyParameters | undefined;
                // reply_markup?: (InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply) | undefined;
            });
        }
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(200).json({ success: false, error: "Processed with errors" });
    }
});




// telegramRouter.post('/:botId', async (req, res) => {
//     try {
//         const botId = req.params.botId;
//         const update = req.body;
//         const chatId = update?.message?.chat?.id;
//         console.log("input", JSON.stringify({ body: req.body, params: req.params }, null, 2));

//         // 0|Ava_SAAS  | input {
//         //     0|Ava_SAAS  |   "body": {
//         //     0|Ava_SAAS  |     "update_id": 150016505,
//         //     0|Ava_SAAS  |     "message": {
//         //     0|Ava_SAAS  |       "message_id": 79,
//         //     0|Ava_SAAS  |       "from": {
//         //     0|Ava_SAAS  |         "id": 6233054381,
//         //     0|Ava_SAAS  |         "is_bot": false,
//         //     0|Ava_SAAS  |         "first_name": "Vishnu",
//         //     0|Ava_SAAS  |         "language_code": "en"
//         //     0|Ava_SAAS  |       },
//         //     0|Ava_SAAS  |       "chat": {
//         //     0|Ava_SAAS  |         "id": 6233054381,
//         //     0|Ava_SAAS  |         "first_name": "Vishnu",
//         //     0|Ava_SAAS  |         "type": "private"
//         //     0|Ava_SAAS  |       },
//         //     0|Ava_SAAS  |       "date": 1743542564,
//         //     0|Ava_SAAS  |       "contact": {
//         //     0|Ava_SAAS  |         "phone_number": "919959964639",
//         //     0|Ava_SAAS  |         "first_name": "Vishnu",
//         //     0|Ava_SAAS  |         "user_id": 6233054381
//         //     0|Ava_SAAS  |       }
//         //     0|Ava_SAAS  |     }
//         //     0|Ava_SAAS  |   },
//         //     0|Ava_SAAS  |   "params": {
//         //     0|Ava_SAAS  |     "botId": "7584917188"
//         //     0|Ava_SAAS  |   }
//         //     0|Ava_SAAS  | }



//         // input {
//         //     0|Ava_SAAS  |   "body": {
//         //     0|Ava_SAAS  |     "update_id": 150016507,
//         //     0|Ava_SAAS  |     "message": {
//         //     0|Ava_SAAS  |       "message_id": 84,
//         //     0|Ava_SAAS  |       "from": {
//         //     0|Ava_SAAS  |         "id": 6233054381,
//         //     0|Ava_SAAS  |         "is_bot": false,
//         //     0|Ava_SAAS  |         "first_name": "Vishnu",
//         //     0|Ava_SAAS  |         "language_code": "en"
//         //     0|Ava_SAAS  |       },
//         //     0|Ava_SAAS  |       "chat": {
//         //     0|Ava_SAAS  |         "id": 6233054381,
//         //     0|Ava_SAAS  |         "first_name": "Vishnu",
//         //     0|Ava_SAAS  |         "type": "private"
//         //     0|Ava_SAAS  |       },
//         //     0|Ava_SAAS  |       "date": 1743542598,
//         //     0|Ava_SAAS  |     }
//         //     0|Ava_SAAS  |   },
//         //     0|Ava_SAAS  |   "params": {
//         //     0|Ava_SAAS  |     "botId": "7584917188"
//         //     0|Ava_SAAS  |   }
//         //     0|Ava_SAAS  | }
//         //     0|Ava_SAAS  | Received location: 17.365977, 78.532945




//         // if (!update || (!update.message && !update.callback_query)) return res.status(400).json({ error: "Invalid update format" });
//         // Retrieve or initialize user state
//         if (!userState.has(chatId)) userState.set(chatId, { contact: null, location: null, messages: [] });
//         let user = userState.get(chatId);
//         // Handle contact sharing
//         const agent = await getBotDetails(botId);
//         // if (!agent) return res.status(404).json({ error: "Bot not found" });
//         const bot = new Telegraf(agent.personalInfo.telegram.botToken);
//         await bot.telegram.sendChatAction(chatId, 'typing');
//         // Handle text messages
//         if (update.message.text) {
//             const userMessage = update.message.text;
//             user.messages.push({ text: userMessage, timestamp: new Date() });
//             if (userMessage.toLowerCase() === '/start') {
//                 await bot.telegram.sendMessage(chatId, "Welcome! How can I help you today?");
//                 return res.status(200).json({ success: true });;
//             }
//             const aiResponse = await generateAIResponse(userMessage, "A helpful assistant");
//             const messagesToSend = [{ text: aiResponse, options: {} }];
//             // Request location only if not already shared



//             // Save updated user data
//             userState.set(chatId, user);
//         }
//         console.log("userState", JSON.stringify(userState, null, 2));
//         res.status(200).json({ success: true });
//     } catch (error) {
//         console.error("Webhook error:", error);
//         res.status(200).json({ success: false, error: "Processed with errors" });
//     }
// });