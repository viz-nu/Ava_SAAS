import { Router } from "express";
import { categorizeTelegramTrigger, getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { Agent, run, RunState, tool } from '@openai/agents';
import { actions, AssistantResponse, getContextMain } from "../utils/openai.js";
import { Conversation } from "../models/Conversations.js";
import { createToolWrapper, getLocation, parseLLMResponse, populateStructure } from "../utils/tools.js";
import { Message } from "../models/Messages.js";
import { sendMail } from "../utils/sendEmail.js";
import { Business } from "../models/Business.js";
export const telegramRouter = Router()

telegramRouter.post('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message, callback_query, inline_query } = req.body;
        if (!message || !message.chat || !message.chat.id) return res.status(200).json({ success: false, error: "Invalid request" }); // Prevents retries
        const chatId = message.chat.id;



        const triggerType = categorizeTelegramTrigger(req.body);
        switch (triggerType) {
            case "text_message":
                break;
            case "photo":
                break;
            case "video":
                break;
            case "document":
                break;
            case "voice":
                break;
            case "audio":
                break;
            case "sticker":
                break;
            case "contact":
                break;
            case "location":
                break;
            case "new_chat_members":
                break;
            case "left_chat_member":
                break;
            case "unknown":
                break;
            case "command":
                break;
            case "edited_message":
                break;
            case "callback_query":
                break;
            case "inline_query":
                break;
            case "chat_join_request":
                break;
            case "my_chat_member":
                break;
            case "chat_member":
                break;
        }

        // {
        //     update_id: 525235010,
        //         message: {
        //         message_id: 11,
        //             from: {
        //             id: 6233054381,
        //                 is_bot: false,
        //                     first_name: 'Vishnu',
        //                         language_code: 'en'
        //         },
        //         chat: { id: 6233054381, first_name: 'Vishnu', type: 'private' },
        //         date: 1752065326,
        //             text: 'He db'
        //     }
        // }


        // const { latitude, longitude } = message.location || {};
        // const { phone_number, first_name, user_id } = message.contact || {};
        const userMessage = message.text || null;



        // const interruptionDecisions = [];
        // Respond immediately to prevent retries
        res.status(200).json({ success: true });
        // Process asynchronously to avoid delays
        setImmediate(async () => {
            try {
                let [{ agentDetails, channelDetails }, conversation] = await Promise.all([getBotDetails({ type: "telegram", botId }), chatId ? Conversation.findOne({ telegramChatId: chatId }) : null]);
                const bot = new Telegraf(channelDetails.secrets.botToken);
                if (triggerType == "command") {
                    const command = userMessage.split(' ')[0].substring(1);
                    let messageToBeSent, messageOptions = {}
                    switch (command.toLowerCase()) {
                        case 'start':
                            messageToBeSent = `${agentDetails.personalInfo.welcomeMessage}\n Here are some commands you can use:\n/help - Show available commands\n/info - Get information about this bot\n/settings - Change your preferences`;
                            break;
                        case 'help':
                            messageToBeSent = `Available commands:\n/start - Start the bot\n/info - Get information about this bot\n/settings - Change your preferences`;
                            break;
                        case 'settings':
                            messageToBeSent = 'What would you like to change?'
                            messageOptions = { reply_markup: { inline_keyboard: [[{ text: 'Notification Settings', callback_data: 'settings_notifications' }, { text: 'Language', callback_data: 'settings_language' }], [{ text: 'Profile', callback_data: 'settings_profile' }]] } };
                            break;

                        case 'info':
                            messageToBeSent = "This is a demo bot showing webhook handling for all message types.";
                            break;

                        default:
                            messageToBeSent = `Unrecognized command: /${command}. Try /help for a list of commands.`;
                            break;
                    }
                    await bot.telegram.sendMessage(chatId, messageToBeSent, messageOptions)
                    return;
                }
                else if (triggerType == "text_message") {
                    let prevMessages = [], state
                    if (conversation) {
                        const messages = await Message.find({ conversationId: conversation._id }).limit(8).select("query response");
                        prevMessages.push(...messages.flatMap(({ query, response }) => {
                            const entries = [];
                            if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                            if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                            return entries;
                        }));
                    } else { conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentDetails._id, telegramChatId: chatId, channel: "telegram" }); }
                    await bot.telegram.sendChatAction(chatId, 'typing');
                    prevMessages.push({ role: "user", content: [{ type: "input_text", text: message.query }] });
                    const toolsJson = agentDetails.actions?.map(ele => (tool(createToolWrapper(ele)))) || [];
                    const agent = new Agent({
                        name: agentDetails.personalInfo.name,
                        instructions: agentDetails.personalInfo.systemPrompt,
                        model: agentDetails.personalInfo.model,
                        toolChoice: 'auto',
                        temperature: agentDetails.personalInfo.temperature,
                        tools: toolsJson,
                    });
                    state = prevMessages
                    const result = await run(agent, state, { stream: false })
                    let message = await Message.create({ business: agentDetails.business._id, query: userMessage, response: result.finalOutput, conversationId: conversation._id });
                    await bot.telegram.sendMessage(chatId, result.finalOutput);
                    // const toolsUsed = result?.state?.lastProcessedResponse?.toolsUsed ?? [];
                    // message.triggeredActions.push(...toolsUsed.map(tool => tool.name));
                    // message.responseTokens.model = result?.state?.lastModelResponse?.model ?? null;
                    // let usage = result?.state?.modelResponses?.usage
                    // let totals = { input_tokens: usage.inputTokens || 0, output_tokens: usage.outputTokens || 0, total_tokens: usage.totalTokens || 0 };
                    // message.responseTokens.usage = totals
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
