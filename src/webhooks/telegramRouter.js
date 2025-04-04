import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { actions, AssistantResponse, getContextMain } from "../utils/openai.js";
import { Conversation } from "../models/Conversations.js";
import { getLocation, parseLLMResponse, populateStructure } from "../utils/tools.js";
import { Message } from "../models/Messages.js";
import { sendMail } from "../utils/sendEmail.js";
export const telegramRouter = Router()

telegramRouter.post('/:botId', async (req, res) => {
    try {
        const { botId } = req.params;
        const { message, callback_query, inline_query } = req.body;
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
                // Update conversation
                const needLocation = !conversation.geoLocation;
                const needContact = !conversation.contact?.phone_number;
                await bot.telegram.sendChatAction(chatId, 'typing');
                // Handle text messages
                if (text) {
                    console.log("Text", text);
                    // handle commands 
                    if (text && text.startsWith('/')) {
                        const command = text.split(' ')[0].substring(1);
                        let messageToBeSent, messageOptions = {}
                        switch (command.toLowerCase()) {
                            case 'start':
                                messageToBeSent = `${agent.personalInfo.welcomeMessage}\n Here are some commands you can use:\n/help - Show available commands\n/info - Get information about this bot\n/settings - Change your preferences`;
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
                    // handle regular texts
                    let prevMessages = []
                    const messages = await Message.find({ conversationId: conversation._id }).select("query response");
                    prevMessages.push(...messages.flatMap(({ query, response }) => {
                        const entries = [];
                        if (query) entries.push({ role: "user", content: query });
                        if (response) entries.push({ role: "assistant", content: response });
                        return entries;
                    }));
                    prevMessages.push({ role: "user", content: text });
                    let listOfIntentions = [{
                        "intent": "enquiry",
                        "dataSchema": [{
                            "key": "Topic",
                            "type": "dynamic",
                            "dataType": "string",
                            "required": true,
                            "comments": "General information requests. The subject of the enquiry (e.g., services, products, policies).",
                            "validator": "",
                            "data": "",
                            "userDefined": true
                        }]
                    },
                    {
                        "intent": "general_chat", "dataSchema": [{
                            "key": "Message",
                            "type": "dynamic",
                            "dataType": "string",
                            "required": true,
                            "comments": "A general conversational message from the user.",
                            "validator": "",
                            "data": "",
                            "userDefined": true
                        }]
                    }]
                    listOfIntentions.push(...agent.actions.filter(action => action.intentType === "Query").map(({ intent, workingData }) => ({ intent, dataSchema: workingData.body })));
                    const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions)
                    const message = await Message.create({ business: agent.business, query: text, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
                    for (const { intent, dataSchema, confidence } of matchedActions) {
                        if (intent == "enquiry") {
                            const { data = text } = dataSchema.find(ele => ele.key == "Topic") || {}
                            const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
                            let config = {
                                additional_instructions: `Today:${new Date()} \n Context: ${answer || null}
                                    **DATA COMPLETENESS PROTOCOL - CRITICAL:**
                                    When you do not have enough information to provide a complete and accurate answer to ANY query, you MUST begin your response with exactly "DATAPOINT_NEXUS" followed by your regular response. This applies to:
                                    - Any specific information not included in the context provided
                                    - Questions where context is missing, incomplete, or unclear
                                    - Requests for details that would require additional data
                                    - Any query where you cannot give a confident and complete answer
                                    Example:
                                        User: "What is the history of..."
                                        Your response: "DATAPOINT_NEXUS Hello! I don't have specific information about the history you're asking about. However, I can tell you that... [continue with what you do know]"`,
                                assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, signalKeyword: "DATAPOINT_NEXUS", streamOption: false
                            }
                            const { responseTokens, response, signalDetected } = await AssistantResponse(req, res, config)
                            const { mainText, followups } = parseLLMResponse(response)
                            const buttons = followups.map((q) => [q]); // each row = one button
                            console.log(buttons);
                            await bot.telegram.sendMessage(chatId, mainText, {
                                reply_markup: {
                                    keyboard: buttons,
                                    resize_keyboard: true,
                                    one_time_keyboard: true // hides after selection
                                }
                            });
                            message.responseTokens = responseTokens
                            message.response = response
                            message.embeddingTokens = embeddingTokens
                            message.context = context
                            if (signalDetected && agent.personalInfo.noDataMail) {
                                try {
                                    console.log("sending mail", { to: agent.personalInfo.noDataMail, topic: data });
                                    let text = `Dear [Support Team],
                    While interacting with the chatbot, it failed to fetch content related to "${data}". This issue is affecting the user experience and needs immediate attention.
                    Please investigate and resolve the issue as soon as possible.
                    Best regards,
                                        Team Avakado`
                                    let html = `<!DOCTYPE html>
                    <html>
                    <head>
                    <meta charset="UTF-8">
                    <title>Chatbot Content Fetch Issue</title>
                    <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f4f4f4;
                        padding: 20px;
                        }
                    .container {
                    background: #ffffff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    }
                    h2 {
                        color: #d9534f;
                    }
                    p {
                        color: #333;
                    }
                    .footer {
                        margin-top: 20px;
                        font-size: 12px;
                        color: #777;
                    }
                    </style>
                    </head>
                    <body>
                    <div class="container">
                    <p>Dear <strong>Support Team</strong>,</p>
                    <p>While interacting with the chatbot, it failed to retrieve content related to <strong>${data}</strong>. This issue is impacting the user experience and requires immediate attention.</p>
                    <p>Please investigate and resolve the issue as soon as possible.</p>
                    <p>Best regards,</p>
                    <p><strong>Team Avakado</strong><br>
                    <div class="footer">
                        <p>This is an automated email. Please do not reply directly.</p>
                    </div>
                    </div>
                    </body>
                                        </html>`
                                    await sendMail({ to: agent.personalInfo.noDataMail, subject: "Urgent: Missing information for AVA", text, html })
                                } catch (error) {
                                    console.error(error);
                                }
                            }
                        }
                        else if (intent == "general_chat") {
                            let config = { assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, streamOption: false }
                            const { responseTokens, response } = await AssistantResponse(req, res, config)
                            const { mainText, followups } = parseLLMResponse(response)
                            const buttons = followups.map((q) => [q]); // each row = one button        
                            console.log(buttons);
                            await bot.telegram.sendMessage(chatId, mainText, {
                                reply_markup: {
                                    keyboard: buttons,
                                    resize_keyboard: true,
                                    one_time_keyboard: true // hides after selection
                                }
                            });
                            message.responseTokens = responseTokens
                            message.response = response
                        }
                        else {
                            await bot.telegram.sendMessage(chatId, "Action supposed to fire");
                        }
                    }
                    await message.save()
                }
                // Ask for missing details
                if (needLocation || needContact) {
                    const buttons = [];
                    if (needLocation) buttons.push({ text: "📍 Share Location", request_location: true });
                    if (needContact) buttons.push({ text: "📞 Share Contact", request_contact: true });
                    await bot.telegram.sendMessage(chatId, `To assist you better, please share your ${needLocation ? "location" : ""}${needLocation && needContact ? " and " : ""}${needContact ? "contact details" : ""}.`, { reply_markup: { keyboard: [buttons], resize_keyboard: true, one_time_keyboard: true } });
                }

                if (callback_query) {
                    const chatId = update.callback_query.message.chat.id;
                    const data = update.callback_query.data;

                    if (data.startsWith('fq::')) {
                        // Optionally pass the question to the LLM again or handle predefined logic
                        let prevMessages = []
                        const messages = await Message.find({ conversationId: conversation._id }).select("query response");
                        prevMessages.push(...messages.flatMap(({ query, response }) => {
                            const entries = [];
                            if (query) entries.push({ role: "user", content: query });
                            if (response) entries.push({ role: "assistant", content: response });
                            return entries;
                        }));
                        prevMessages.push({ role: "user", content: text });
                        let listOfIntentions = [{
                            "intent": "enquiry",
                            "dataSchema": [{
                                "key": "Topic",
                                "type": "dynamic",
                                "dataType": "string",
                                "required": true,
                                "comments": "General information requests. The subject of the enquiry (e.g., services, products, policies).",
                                "validator": "",
                                "data": "",
                                "userDefined": true
                            }]
                        },
                        {
                            "intent": "general_chat", "dataSchema": [{
                                "key": "Message",
                                "type": "dynamic",
                                "dataType": "string",
                                "required": true,
                                "comments": "A general conversational message from the user.",
                                "validator": "",
                                "data": "",
                                "userDefined": true
                            }]
                        }]
                        listOfIntentions.push(...agent.actions.filter(action => action.intentType === "Query").map(({ intent, workingData }) => ({ intent, dataSchema: workingData.body })));
                        const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions)
                        const message = await Message.create({ business: agent.business, query: text, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
                        for (const { intent, dataSchema, confidence } of matchedActions) {
                            console.log("intentions", intent);
                            console.log("dataSchema", dataSchema);
                            if (intent == "enquiry") {
                                const { data = text } = dataSchema.find(ele => ele.key == "Topic") || {}
                                const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
                                let config = {
                                    additional_instructions: `Today:${new Date()} \n Context: ${answer || null}
                                        **DATA COMPLETENESS PROTOCOL - CRITICAL:**
                                        When you do not have enough information to provide a complete and accurate answer to ANY query, you MUST begin your response with exactly "DATAPOINT_NEXUS" followed by your regular response. This applies to:
                                        - Any specific information not included in the context provided
                                        - Questions where context is missing, incomplete, or unclear
                                        - Requests for details that would require additional data
                                        - Any query where you cannot give a confident and complete answer
                                        Example:
                                            User: "What is the history of..."
                                            Your response: "DATAPOINT_NEXUS Hello! I don't have specific information about the history you're asking about. However, I can tell you that... [continue with what you do know]"`,
                                    assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, signalKeyword: "DATAPOINT_NEXUS", streamOption: false
                                }
                                const { responseTokens, response, signalDetected } = await AssistantResponse(req, res, config)
                                const { mainText, followups } = parseLLMResponse(response)
                                const buttons = followups.map((q) => [q]); // each row = one button                                await bot.telegram.answerCbQuery(callback_query.id);
                                console.log(buttons);
                                await bot.telegram.sendMessage(chatId, mainText, {
                                    reply_markup: {
                                        keyboard: buttons,
                                        resize_keyboard: true,
                                        one_time_keyboard: true // hides after selection
                                    }
                                });
                                message.responseTokens = responseTokens
                                message.response = response
                                message.embeddingTokens = embeddingTokens
                                message.context = context
                                if (signalDetected && agent.personalInfo.noDataMail) {
                                    try {
                                        console.log("sending mail", { to: agent.personalInfo.noDataMail, topic: data });
                                        let text = `Dear [Support Team],
                        While interacting with the chatbot, it failed to fetch content related to "${data}". This issue is affecting the user experience and needs immediate attention.
                        Please investigate and resolve the issue as soon as possible.
                        Best regards,
                                            Team Avakado`
                                        let html = `<!DOCTYPE html>
                        <html>
                        <head>
                        <meta charset="UTF-8">
                        <title>Chatbot Content Fetch Issue</title>
                        <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            padding: 20px;
                            }
                        .container {
                        background: #ffffff;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        }
                        h2 {
                            color: #d9534f;
                        }
                        p {
                            color: #333;
                        }
                        .footer {
                            margin-top: 20px;
                            font-size: 12px;
                            color: #777;
                        }
                        </style>
                        </head>
                        <body>
                        <div class="container">
                        <p>Dear <strong>Support Team</strong>,</p>
                        <p>While interacting with the chatbot, it failed to retrieve content related to <strong>${data}</strong>. This issue is impacting the user experience and requires immediate attention.</p>
                        <p>Please investigate and resolve the issue as soon as possible.</p>
                        <p>Best regards,</p>
                        <p><strong>Team Avakado</strong><br>
                        <div class="footer">
                            <p>This is an automated email. Please do not reply directly.</p>
                        </div>
                        </div>
                        </body>
                                            </html>`
                                        await sendMail({ to: agent.personalInfo.noDataMail, subject: "Urgent: Missing information for AVA", text, html })
                                    } catch (error) {
                                        console.error(error);
                                    }
                                }
                            }
                            else if (intent == "general_chat") {
                                let config = { assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, streamOption: false }
                                const { responseTokens, response } = await AssistantResponse(req, res, config)
                                const { mainText, followups } = parseLLMResponse(response)
                                const buttons = followups.map((q) => [q]); // each row = one button                           
                                await bot.telegram.answerCbQuery(callback_query.id);
                                console.log(buttons);
                                await bot.telegram.sendMessage(chatId, mainText, {
                                    reply_markup: {
                                        keyboard: buttons,
                                        resize_keyboard: true,
                                        one_time_keyboard: true // hides after selection
                                    }
                                });
                                message.responseTokens = responseTokens
                                message.response = response
                            }
                            else {
                                await bot.telegram.sendMessage(chatId, "Action supposed to fire");
                            }
                        }
                        await message.save()

                    }
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
