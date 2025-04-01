import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { generateAIResponse } from "../utils/openai.js";
export const telegramRouter = Router()
// telegramRouter.post('/:botId', async (req, res) => {
//     try {
//         const botId = req.params.botId;
//         const { message } = req.body;
//         console.log({ body: req.body, params: req.params.botId });

//         if (!message || !message.chat) {
//             return res.status(400).json({ error: "Invalid message format" });
//         }
//         // Fetch bot token from database 
//         const agent = await getBotDetails(botId);
//         if (!agent) return res.status(404).json({ error: "Bot not found" });


//         const bot = new Telegraf(agent.personalInfo.telegram.botToken);

//         // bot.on("text", async (ctx) => {
//         //     const chatId = ctx.chat.id;
//         //     await ctx.reply(`Echo: ${ctx.message.text}`);
//         // });


//         res.json({ success: true, data: { body: req.body, params: req.params.botId } });
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ msg: "internal server error" });
//     }
// });

// Function to generate response using OpenAI


telegramRouter.post('/:botId', async (req, res) => {
    try {
        const botId = req.params.botId;
        const update = req.body;
        let locationShared = false;
        let contactShared = false;
        console.log("input", JSON.stringify({ body: update, params: botId }, null, 2));

        // update ={
        //     "update_id": 150016471,
        //     "message": {
        //         "message_id": 27,
        //         "from": {
        //             "id": 6233054381,
        //             "is_bot": false,
        //             "first_name": "Vishnu",
        //             "language_code": "en"
        //         },
        //         "chat": {
        //             "id": 6233054381,
        //             "first_name": "Vishnu",
        //             "type": "private"
        //         },
        //         "date": 1743537520,
        //         "text": "Hey who are you?"
        //     }
        // }
        // Handle different types of updates
        if (!update || (!update.message && !update.callback_query)) return res.status(400).json({ error: "Invalid update format" });
        if (update.message.location) {
            const { latitude, longitude } = update.message.location;
            console.log(`Received location: ${latitude}, ${longitude}`);
            // await bot.telegram.sendMessage(chatId, `Thank you for sharing your location!`);
            locationShared = true;
        }
        if (update.message.contact) {
            const { phone_number, first_name, last_name } = update.message.contact;
            console.log(`Received contact: ${phone_number}, ${first_name} ${last_name || ''}`);
            // await bot.telegram.sendMessage(chatId, `Thank you for sharing your contact information!`);
            contactShared = true;
        }
        if ((locationShared || contactShared) && !update.message.text) return;
        // Fetch bot details from database
        const agent = await getBotDetails(botId);
        if (!agent) return res.status(404).json({ error: "Bot not found" });
        const bot = new Telegraf(agent.personalInfo.telegram.botToken);
        // Handle the incoming message
        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const userMessage = update.message.text;


            try {
                if (userMessage.toLowerCase() === '/start') {
                    await bot.telegram.sendMessage(chatId, "Welcome! I'm your assistant. How can I help you today?");
                    return;
                }
                const botPersonality = "A helpful assistant on behalf of viz -a backend engineer, based out of India";
                const aiResponse = await generateAIResponse(userMessage, botPersonality);
                // Create an array for our messages to send
                const messagesToSend = [];

                // Add AI response
                messagesToSend.push({ text: aiResponse, options: {} });
                // Ask for location if not shared yet
                if (!locationShared) {
                    messagesToSend.push({
                        text: "To provide you with more personalized assistance, could you share your location?",
                        options: {
                            reply_markup: {
                                keyboard: [
                                    [{ text: "📍 Share my location", request_location: true }]
                                ],
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    });
                }

                // Ask for contact if not shared yet
                if (!contactShared) {
                    messagesToSend.push({
                        text: "Also, sharing your contact information would help me assist you better.",
                        options: {
                            reply_markup: {
                                keyboard: [
                                    [{ text: "📞 Share my contact", request_contact: true }]
                                ],
                                resize_keyboard: true,
                                one_time_keyboard: true
                            }
                        }
                    });
                }
                // Send all messages
                for (const message of messagesToSend) await bot.telegram.sendMessage(chatId, message.text, message.options);
                console.log("response sent: ", aiResponse);
            }
            catch (error) {
                console.error("Error generating response:", error);
                await bot.telegram.sendMessage(chatId, "Sorry, I encountered an error while processing your request.");
            }
        }
        else if (update.message && (update.message.location || update.message.contact)) {
            const chatId = update.message.chat.id;

            if (update.message.location) {
                const { latitude, longitude } = update.message.location;
                console.log(`User shared location: ${latitude}, ${longitude}`);
                await bot.telegram.sendMessage(chatId, "Thank you for sharing your location! How can I assist you today?");
            }

            if (update.message.contact) {
                const { phone_number, first_name } = update.message.contact;
                console.log(`User shared contact: ${phone_number}, ${first_name}`);
                await bot.telegram.sendMessage(chatId, "Thank you for sharing your contact information! How can I assist you today?");
            }
        }

        // Handle callback queries (for button clicks)
        if (update.callback_query) {
            // const chatId = update.callback_query.message.chat.id;
            // const data = update.callback_query.data;

            // // Generate AI response for the callback data
            // const aiResponse = await generateAIResponse(`User clicked button: ${data}`,
            //     agent.personalInfo.personality || "A helpful assistant");

            // // Send response back to user
            // await bot.telegram.sendMessage(chatId, aiResponse);
            // await bot.telegram.answerCallbackQuery(update.callback_query.id);
        }

        // Always respond with 200 OK to Telegram quickly


        res.status(200).json({ success: true });

    } catch (error) {
        console.error("Webhook error:", error);
        // Still return 200 to Telegram to avoid retry loops
        res.status(200).json({ success: false, error: "Processed with errors" });
    }
});