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
        const { botId } = req.params;
        const { message } = req.body;
        if (!message || !message.chat || !message.chat.id) return res.status(200).json({ success: false, error: "Invalid request" }); // Prevents retries
        const chatId = message.chat.id;
        const { latitude, longitude } = message.location || {};
        const { phone_number, first_name, user_id } = message.contact || {};
        const text = message.text || null;

        // Respond immediately to prevent retries
        res.status(200).json({ success: true });

        // Process asynchronously to avoid delays
        setImmediate(async () => {
            try {
                const agent = await getBotDetails(botId);
                if (!agent || !agent.personalInfo?.telegram?.botToken) return;

                const bot = new Telegraf(agent.personalInfo.telegram.botToken);
                const conversation = await Conversation.findOneAndUpdate(
                    { telegramChatId: chatId },
                    {
                        $setOnInsert: { agent: agent._id, business: agent.business },
                        ...(latitude && longitude ? { geoLocation: await getLocation(latitude, longitude) } : {}),
                        ...(phone_number && first_name && user_id ? { contact: { phone_number, first_name, user_id } } : {})
                    },
                    { upsert: true, new: true }
                );

                console.log("agent", JSON.stringify(agent, null, 2));
                console.log("conversation", JSON.stringify(conversation, null, 2));

                // Update conversation
                const needLocation = !conversation.geoLocation && !latitude && !longitude;
                const needContact = !conversation.contact && !(phone_number && first_name && user_id);
                // Ask for missing details
                if (needLocation || needContact) {
                    const buttons = [];
                    if (needLocation) buttons.push({ text: "📍 Share Location", request_location: true });
                    if (needContact) buttons.push({ text: "📞 Share Contact", request_contact: true });

                    await bot.telegram.sendMessage(chatId, `To assist you better, please share your ${needLocation ? "location" : ""}${needLocation && needContact ? " and " : ""}${needContact ? "contact details" : ""}.`, {
                        reply_markup: {
                            keyboard: [buttons],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    });
                }

                await bot.telegram.sendChatAction(chatId, 'typing');
                // Handle text messages
                if (text) {
                    const aiResponse = await generateAIResponse(text, "A helpful assistant");
                    await bot.telegram.sendMessage(chatId, aiResponse);
                }
            } catch (error) {
                console.error("Processing error:", error);
            }
        });

    } catch (error) {
        console.error("Webhook error:", error);
        return res.status(200).json({ success: false, error: "Processed with errors" }); // Always return 200 to prevent retries
    }
});




// message_thread_id?: number | undefined;
// parse_mode?: ParseMode | undefined;
// entities?: MessageEntity[] | undefined;
// link_preview_options?: LinkPreviewOptions | undefined;
// disable_notification?: boolean | undefined;
// protect_content?: boolean | undefined;
// reply_parameters?: ReplyParameters | undefined;
// reply_markup?: (InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply) | undefined;