import { Router } from "express";
import { categorizeTelegramTrigger, getBotDetails, loggingResults } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { Agent, run, RunState, tool } from '@openai/agents';
import { actions, AssistantResponse, getContextMain } from "../utils/openai.js";
import { Conversation } from "../models/Conversations.js";
import { createToolWrapper, getLocation, parseLLMResponse, populateStructure } from "../utils/tools.js";
import { Message } from "../models/Messages.js";
import { sendMail } from "../utils/sendEmail.js";
import { Business } from "../models/Business.js";

import { z } from "zod";

const BotResponseSchema = z.object({
    message: z.string(), // main text
    buttons: z.array(
        z.object({
            text: z.string(),
            callback_data: z.string().optional(),
            url: z.string().optional()
        })
    ).optional()
});



export const telegramRouter = Router()

telegramRouter.post('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message, callback_query, inline_query } = req.body;
        if (!message || !message.chat || !message.chat.id) return res.status(200).json({ success: false, error: "Invalid request" }); // Prevents retries
        const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
        if (!chatId) return res.status(200).json({ success: false, error: "Invalid request" });
        const triggerType = categorizeTelegramTrigger(req.body);
        res.status(200).json({ success: true });
        setImmediate(async () => {
            try {
                let [{ agentDetails, channelDetails }, conversation] = await Promise.all([getBotDetails({ type: "telegram", botId }), chatId ? Conversation.findOne({ telegramChatId: chatId }) : null]);
                const bot = new Telegraf(channelDetails.secrets.botToken);

                if (triggerType === "command") {
                    const userMessage = message.text;
                    const command = userMessage.split(' ')[0].substring(1);
                    let messageToBeSent, messageOptions = {};
                    switch (command.toLowerCase()) {
                        case 'start':
                            messageToBeSent = `${agentDetails.personalInfo.welcomeMessage}\nHere are some commands:\n/help - Show available commands\n/info - Bot info\n/settings - Change preferences`;
                            break;
                        case 'help':
                            messageToBeSent = `Available commands:\n/start - Start the bot\n/info - Bot info\n/settings - Preferences`;
                            break;
                        case 'settings':
                            messageToBeSent = 'What would you like to change?';
                            messageOptions = {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            { text: 'Notification Settings', callback_data: 'settings_notifications' },
                                            { text: 'Language', callback_data: 'settings_language' }
                                        ],
                                        [{ text: 'Profile', callback_data: 'settings_profile' }]
                                    ]
                                }
                            };
                            break;
                        case 'info':
                            messageToBeSent = "This is a demo bot showcasing webhook handling.";
                            break;
                        default:
                            messageToBeSent = `Unrecognized command: /${command}. Try /help for options.`;
                            break;
                    }
                    await bot.telegram.sendMessage(chatId, messageToBeSent, messageOptions);
                    return;
                }
                if (triggerType === "callback_query") {
                    const callbackData = callback_query.data;
                    await bot.telegram.answerCbQuery(callback_query.id); // Required

                    // Fetch bot + conversation
                    let [{ agentDetails }, conversation] = await Promise.all([
                        getBotDetails({ type: "telegram", botId }),
                        Conversation.findOne({ telegramChatId: chatId })
                    ]);

                    const prevMessages = [];
                    if (conversation) {
                        const messages = await Message.find({ conversationId: conversation._id }).limit(8);
                        prevMessages.push(...messages.flatMap(({ query, response }) => {
                            const arr = [];
                            if (query) arr.push({ role: "user", content: [{ type: "input_text", text: query }] });
                            if (response) arr.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                            return arr;
                        }));
                    }

                    // Treat callback as a "user action"
                    prevMessages.push({ role: "user", content: [{ type: "input_text", text: `User clicked button: ${callbackData}` }] });

                    const agent = new Agent({
                        name: agentDetails.personalInfo.name,
                        instructions: agentDetails.personalInfo.systemPrompt + "\nHandle user button clicks intelligently.",
                        model: agentDetails.personalInfo.model,
                        toolChoice: 'auto',
                        temperature: agentDetails.personalInfo.temperature,
                        tools: [], // Your tools here
                        outputType: BotResponseSchema
                    });

                    const result = await run(agent, prevMessages, { stream: false });
                    const { message: replyText, buttons } = result.finalOutput;

                    const inlineKeyboard = buttons ? buttons.map(b => [{ text: b.text, callback_data: b.callback_data || undefined, url: b.url || undefined }]) : [];

                    await bot.telegram.sendMessage(chatId, replyText, {
                        reply_markup: { inline_keyboard: inlineKeyboard }
                    });
                }

                if (triggerType === "text_message") {
                    const userMessage = message.text;
                    await bot.telegram.sendChatAction(chatId, 'typing');
                    let prevMessages = [], state;
                    if (conversation) {
                        const messages = await Message.find({ conversationId: conversation._id })
                            .limit(8).select("query response");
                        prevMessages.push(...messages.flatMap(({ query, response }) => {
                            const entries = [];
                            if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                            if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                            return entries;
                        }));
                    } else {
                        conversation = await Conversation.create({
                            business: agentDetails.business._id,
                            agent: agentDetails._id,
                            telegramChatId: chatId,
                            channel: "telegram"
                        });
                    }

                    prevMessages.push({ role: "user", content: [{ type: "input_text", text: userMessage }] });

                    const toolsJson = agentDetails.actions?.map(ele => (tool(createToolWrapper(ele)))) || [];
                    if (agentDetails.collections.length > 0) toolsJson.push(knowledgeToolBaker(agentDetails.collections));

                    const extraPrompt = `
                    Always return a JSON object with:
                    - message: The text to show the user
                    - buttons: Optional array of objects with { text, callback_data OR url }
                    `;

                    const agent = new Agent({
                        name: agentDetails.personalInfo.name,
                        instructions: agentDetails.personalInfo.systemPrompt + extraPrompt,
                        model: agentDetails.personalInfo.model,
                        toolChoice: 'auto',
                        temperature: agentDetails.personalInfo.temperature,
                        tools: toolsJson,
                        outputType: BotResponseSchema,
                    });

                    state = prevMessages;

                    const result = await run(agent, state, { stream: false });

                    const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
                    result.rawResponses.forEach(ele => {
                        usage.input_tokens += ele.usage.inputTokens;
                        usage.output_tokens += ele.usage.outputTokens;
                        usage.total_tokens += ele.usage.totalTokens;
                    });

                    const { message: replyText, buttons } = result.finalOutput;

                    const inlineKeyboard = buttons
                        ? buttons.map(b => [{ text: b.text, callback_data: b.callback_data || undefined, url: b.url || undefined }])
                        : [];

                    await Message.create({
                        business: agentDetails.business._id,
                        query: userMessage,
                        response: JSON.stringify(result.finalOutput),
                        conversationId: conversation._id,
                        responseTokens: { model: agentDetails.personalInfo.model ?? null, usage }
                    });

                    await bot.telegram.sendMessage(chatId, replyText, {
                        reply_markup: { inline_keyboard: inlineKeyboard }
                    });
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

// switch (triggerType) {
//     case "text_message":
//         break;
//     case "photo":
//         break;
//     case "video":
//         break;
//     case "document":
//         break;
//     case "voice":
//         break;
//     case "audio":
//         break;
//     case "sticker":
//         break;
//     case "contact":
//         break;
//     case "location":
//         break;
//     case "new_chat_members":
//         break;
//     case "left_chat_member":
//         break;
//     case "unknown":
//         break;
//     case "command":
//         break;
//     case "edited_message":
//         break;
//     case "callback_query":
//         break;
//     case "inline_query":
//         break;
//     case "chat_join_request":
//         break;
//     case "my_chat_member":
//         break;
//     case "chat_member":
//         break;
// }
// const userMessage = message.text || null;
