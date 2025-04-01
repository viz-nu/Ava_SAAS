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

        console.log("input", JSON.stringify({ body: update, params: botId }, null, 2));

        // Handle different types of updates
        if (!update || (!update.message && !update.callback_query)) return res.status(400).json({ error: "Invalid update format" });

        // Fetch bot details from database
        const agent = await getBotDetails(botId);
        if (!agent) return res.status(404).json({ error: "Bot not found" });
        const bot = new Telegraf(agent.personalInfo.telegram.botToken);

        // Handle the incoming message
        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const userMessage = update.message.text;

            // Get bot personality from agent data
            const botPersonality = "A helpful assistant on behalf of viz -a backend engineer, based out of India";

            // Generate AI response
            const aiResponse = await generateAIResponse(userMessage, botPersonality);

            // Send response back to user
            await bot.telegram.sendMessage(chatId, aiResponse);
            console.log("response sent: ", aiResponse);
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