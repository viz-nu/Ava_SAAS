import { Router } from "express";
import { categorizeTelegramTrigger, getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { Agent, run, RunState, tool } from '@openai/agents';
import { Conversation } from "../models/Conversations.js";
import { createToolWrapper, knowledgeToolBaker } from "../utils/tools.js";
import { Message } from "../models/Messages.js";

import { z } from "zod";
const sendApprovalRequest = async (bot, chatId, interruptions) => {
    for (const interruption of interruptions) {
        const message = `🔧 Tool Approval Required\n\nAgent "${interruption.agent.name}" wants to use the tool "${interruption.rawItem.name}" with the following parameters:\n\n${interruption.rawItem.arguments}\n\nDo you approve this action?`,
            inlineKeyboard = [{ callback_data: `approve_${interruption.id}`, text: "✅ Approve" }, { callback_data: `reject_${interruption.id}`, text: "❌ Reject" }]
        await bot.telegram.sendMessage(chatId, message, { reply_markup: { inline_keyboard: inlineKeyboard } });
    }
}
async function processUserMessage(chatId, userMessage, bot, agentDetails, message) {
    const { userMessageType, userMessageData } = userMessage
    const conversation = await Conversation.findOne({ telegramChatId: chatId });
    const toolsJson = agentDetails.actions?.map(ele => (tool(createToolWrapper(ele)))) || [];
    if (agentDetails.collections.length > 0) toolsJson.push(tool(createToolWrapper(knowledgeToolBaker(agentDetails.collections))));
    const extraPrompt = `
                If max turns are exceeded, provide a concise summary or polite closing message.
                Always return a JSON object with:
                    - message: string
                    - buttons: array of objects with fields:
                    text (string), callback_data (string or null), url (string or null)
                    If there are no buttons, set buttons to null.
                    Try to be more interactive with buttons
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
    let state
    await bot.telegram.sendChatAction(chatId, 'typing');
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
            conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentDetails._id, telegramChatId: chatId, channel: "telegram" });
        }
        state.push({ role: "user", content: [{ type: "input_text", text: userMessageData.text }] });
    }
    else if (userMessageType == "tool_approval") {
        const interruptionId = userMessageData.buttonId.replace(userMessageData.approved ? 'approve_' : 'reject_', '');
        state = await RunState.fromString(agent, conversation.state);
        const interruption = conversation.pendingInterruptions.find(i => i.id === interruptionId);
        if (!interruption) {
            await bot.telegram.sendMessage(chatId, "❌ Interruption not found. Please try again the same request.");
            return;
        }
        if (userMessageData.approved) {
            state.approve(interruption);
            await bot.telegram.sendMessage(chatId, "✅ Tool approved. Processing...");
        } else {
            state.reject(interruption);
            await bot.telegram.sendMessage(chatId, "❌ Tool rejected. Continuing without this action...");
        }
    }
    const result = await run(agent, state, { stream: false, maxTurns: 3, context: `${message.from.first_name ? "User Name: " + message.from.first_name : ""}\nDate: ${new Date().toDateString()} \n Channel:telegram \n telegramId:${message.from.id} ` });
    if (result.interruptions?.length > 0) {
        const interruptionData = result.interruptions.map(interruption => ({ ...interruption, timestamp: new Date(), status: 'pending' }));
        conversation = await Conversation.findByIdAndUpdate(conversation._id, { $push: { pendingInterruptions: { $each: interruptionData } }, $set: { state: JSON.stringify(result.state) } }, { new: true });
        // Send approval request to user
        await sendApprovalRequest(bot, chatId, result.interruptions);
        return; // Exit early, wait for user approval
    }
    const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    result.rawResponses.forEach(ele => { usage.input_tokens += ele.usage.inputTokens; usage.output_tokens += ele.usage.outputTokens; usage.total_tokens += ele.usage.totalTokens; });
    const { message: replyText, buttons } = result.finalOutput;
    const inlineKeyboard = buttons ? buttons.map(b => [{ text: b.text, callback_data: b.callback_data || undefined, url: b.url || undefined }]) : [];
    await Message.create({ business: agentDetails.business._id, query: userMessage, response: JSON.stringify(result.finalOutput), conversationId: conversation._id, responseTokens: { model: agentDetails.personalInfo.model ?? null, usage } });
    await bot.telegram.sendMessage(chatId, replyText, { reply_markup: { inline_keyboard: inlineKeyboard } });
}
export const BotResponseSchema = z.object({
    message: z.string(),
    buttons: z.array(
        z.object({
            text: z.string(),
            callback_data: z.string().nullable(), // ✅ Now nullable
            url: z.string().nullable()            // ✅ Now nullable
        })
    ).nullable() // ✅ The whole buttons array can be null
});


export const telegramRouter = Router()

telegramRouter.post('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message, callback_query, inline_query } = req.body;
        const chatId = message?.chat?.id || callback_query?.message?.chat?.id;
        if (!chatId) return res.status(200).json({ success: false, error: "Invalid request" });
        const triggerType = categorizeTelegramTrigger(req.body);
        res.status(200).json({ success: true });
        setImmediate(async () => {
            try {
                let { agentDetails, channelDetails } = await getBotDetails({ type: "telegram", botId })
                // chatId ? 
                const bot = new Telegraf(channelDetails.secrets.botToken);
                let userMessage
                switch (triggerType) {
                    case "command":
                        userMessage = message.text;
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
                    case "callback_query":
                        await bot.telegram.answerCbQuery(callback_query.id); // Required
                        if (callback_query.data.startsWith('approve_')) {
                            await processUserMessage(chatId, { userMessageType: "tool_approval", userMessageData: { buttonId: callback_query.data, approved: true } }, bot, agentDetails);
                            return;
                        } else if (callback_query.data.startsWith('reject_')) {
                            await processUserMessage(chatId, { userMessageType: "tool_approval", userMessageData: { buttonId: callback_query.data, approved: false } }, bot, agentDetails);
                            return;
                        }
                        userMessage = callback_query.data;
                        break;
                    case "text_message":
                        userMessage = message.text;
                        break;
                    default:
                        console.log({ triggerType });
                        return;
                }
                await processUserMessage(chatId, { userMessageType: "text", userMessageData: { text: userMessage } }, bot, agentDetails, message);
                return;
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
