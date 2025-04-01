import { Router } from "express";
export const telegramRouter = Router()
telegramRouter.post('/:botId', async (req, res) => {
    try {
        const botId = req.params.botId;
        const { message } = req.body;

        // if (!message || !message.chat) {
        //     return res.status(400).json({ error: "Invalid message format" });
        // }

        // // Fetch bot token from database (dummy function)
        // const botToken = await getBotToken(botId);
        // if (!botToken) {
        //     return res.status(404).json({ error: "Bot not found" });
        // }

        // // Handle messages using Telegraf bot instance
        // const bot = new Telegraf(botToken);

        // bot.on("text", async (ctx) => {
        //     const chatId = ctx.chat.id;
        //     await ctx.reply(`Echo: ${ctx.message.text}`);
        // });

        // // Process update manually since we're not using `launch()`
        // bot.handleUpdate(req.body);

        res.json({ success: true, data: {body:req.body,params:req.params.botId} });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});