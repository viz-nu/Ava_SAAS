import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { generateAIResponse } from "../utils/openai.js";
export const telegramRouter = Router()
const userState = new Map(); // Store user data in-memory (consider Redis/DB for long-term storage)

telegramRouter.post('/:botId', async (req, res) => {
    try {
        const botId = req.params.botId;
        const update = req.body;
        const chatId = update?.message?.chat?.id;
        if (!update || (!update.message && !update.callback_query)) return res.status(400).json({ error: "Invalid update format" });

        // Retrieve or initialize user state
        if (!userState.has(chatId)) userState.set(chatId, { contact: null, location: null, messages: [] });
        let user = userState.get(chatId);
        // Handle contact sharing
        if (update.message.contact) {
            const { phone_number, first_name } = update.message.contact;
            console.log(`Received contact: ${phone_number}, ${first_name}`);
            user.contact = { phone_number, first_name };
            userState.set(chatId, user);
            await bot.telegram.sendMessage(chatId, "Thanks for sharing your contact!");
        }

        // Handle location sharing
        if (update.message.location) {
            const { latitude, longitude } = update.message.location;
            console.log(`Received location: ${latitude}, ${longitude}`);
            user.location = { latitude, longitude };
            userState.set(chatId, user);
            await bot.telegram.sendMessage(chatId, "Thanks for sharing your location!");
        }

        // Handle text messages
        if (update.message.text) {
            const userMessage = update.message.text;
            user.messages.push({ text: userMessage, timestamp: new Date() });
            if (userMessage.toLowerCase() === '/start') {
                await bot.telegram.sendMessage(chatId, "Welcome! How can I help you today?");
                return;
            }
            const aiResponse = await generateAIResponse(userMessage, "A helpful assistant");
            const messagesToSend = [{ text: aiResponse, options: {} }];
            // Request location only if not already shared
            if (!user.location) {
                messagesToSend.push({
                    text: "To assist you better, could you share your location?",
                    options: {
                        reply_markup: {
                            keyboard: [[{ text: "📍 Share my location", request_location: true }]],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                });
            }
            // Request contact only if not already shared
            if (!user.contact) {
                messagesToSend.push({
                    text: "Also, could you share your contact details for better assistance?",
                    options: {
                        reply_markup: {
                            keyboard: [[{ text: "📞 Share my contact", request_contact: true }]],
                            resize_keyboard: true,
                            one_time_keyboard: true
                        }
                    }
                });
            }
            // Send messages
            for (const message of messagesToSend) {
                await bot.telegram.sendMessage(chatId, message.text, message.options);
            }
            // Save updated user data
            userState.set(chatId, user);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(200).json({ success: false, error: "Processed with errors" });
    }
});