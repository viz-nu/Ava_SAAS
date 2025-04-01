import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { generateAIResponse } from "../utils/openai.js";
export const telegramRouter = Router()
telegramRouter.post('/:botId', async (req, res) => {
    try {
        const botId = req.params.botId;
        const update = req.body;
        if (!update || (!update.message && !update.callback_query)) return res.status(400).json({ error: "Invalid update format" });
        console.log("Received Update:", JSON.stringify({ body: update, params: botId }, null, 2));
        const agent = await getBotDetails(botId);
        if (!agent) return res.status(404).json({ error: "Bot not found" });
        const bot = new Telegraf(agent.personalInfo.telegram.botToken);
        await bot.telegram.sendChatAction(chatId, 'typing');
        const chatId = update.message?.chat?.id;
        if (!chatId) return res.status(200).json({ success: false, error: "Invalid chat data" });
        let locationShared = !!update.message?.location;
        let contactShared = !!update.message?.contact;
        let userMessage = update.message?.text;
        if (locationShared) {
            const { latitude, longitude } = update.message.location;
            console.log(`Received location: ${latitude}, ${longitude}`);
            await bot.telegram.sendMessage(chatId, "Thanks for sharing your location! How can I assist you today?");
        }
        if (contactShared) {
            const { phone_number, first_name, last_name } = update.message.contact;
            console.log(`Received contact: ${phone_number}, ${first_name} ${last_name || ''}`);
            await bot.telegram.sendMessage(chatId, "Thanks for sharing your contact! How can I assist you today?");
        }
        if (userMessage) {
            try {
                if (userMessage.toLowerCase() === '/start') {
                    await bot.telegram.sendMessage(chatId, "Welcome! I'm your assistant. How can I help you today?");
                    return res.status(200).json({ success: true });
                }
                const botPersonality = "A helpful assistant on behalf of viz - a backend engineer based in India.";
                const aiResponse = await generateAIResponse(userMessage, botPersonality);
                const messagesToSend = [{ text: aiResponse, options: {} }];
                if (!locationShared) {
                    messagesToSend.push({
                        text: "To provide you with more personalized assistance, could you share your location?",
                        options: {
                            reply_markup: {
                                keyboard: [[{ text: "📍 Share my location", request_location: true }]],
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    });
                }
                if (!contactShared) {
                    messagesToSend.push({
                        text: "Also, sharing your contact information would help me assist you better.",
                        options: {
                            reply_markup: {
                                keyboard: [[{ text: "📞 Share my contact", request_contact: true }]],
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    });
                }
                for (const message of messagesToSend) {
                    await bot.telegram.sendMessage(chatId, message.text, message.options);
                }
                console.log("Response sent:", aiResponse);
            } catch (error) {
                console.error("Error generating response:", error);
                await bot.telegram.sendMessage(chatId, "Sorry, I encountered an error while processing your request.");
            }
        }
        if (update.callback_query) {
            const callbackId = update.callback_query.id;
            const data = update.callback_query.data;
            console.log("Received callback query:", data);
            const aiResponse = await generateAIResponse(`User clicked: ${data}`, botPersonality);
            await bot.telegram.sendMessage(chatId, aiResponse);
            await bot.telegram.answerCallbackQuery(callbackId);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(200).json({ success: false, error: "Processed with errors" });
    }
});