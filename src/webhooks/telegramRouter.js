import { Router } from "express";
import { getBotDetails } from "../utils/telegraf.js";
import { Telegraf } from "telegraf";
import { actions, AssistantResponse, getContextMain } from "../utils/openai.js";
import { Conversation } from "../models/Conversations.js";
import { getLocation, populateStructure } from "../utils/tools.js";
import { Message } from "../models/Messages.js";
import { sendMail } from "../utils/sendEmail.js";
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
                // Update conversation
                const needLocation = !conversation.geoLocation && !latitude && !longitude;
                const needContact = !conversation.contact && !(phone_number && first_name && user_id);
                await bot.telegram.sendChatAction(chatId, 'typing');
                // Handle text messages
                if (text) {
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
                    let tasks = matchedActions.map(async ({ intent, dataSchema, confidence }) => {
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
                            await bot.telegram.sendMessage(chatId, response);
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
                            await bot.telegram.sendMessage(chatId, response);
                            message.responseTokens = responseTokens
                            message.response = response
                        }
                        else {
                            await bot.telegram.sendMessage(chatId, "Action supposed to fire");
                            // const currentAction = agent.actions.find(ele => intent == ele.intent)
                            // const dataMap = new Map();
                            // dataSchema.forEach(item => { dataMap.set(item.key, item.data) });
                            // let respDataSchema = populateStructure(currentAction._doc.workingData.body, dataMap);
                            // res.write(JSON.stringify({ id: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence }, responseType: "full", conversationId: conversation._id }))
                            // message.Actions.push({ type: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence } })
                        }
                    })
                    await Promise.all(tasks);
                    await message.save()
                }
                // Ask for missing details
                if (needLocation || needContact) {
                    const buttons = [];
                    if (needLocation) buttons.push({ text: "📍 Share Location", request_location: true });
                    if (needContact) buttons.push({ text: "📞 Share Contact", request_contact: true });
                    await bot.telegram.sendMessage(chatId, `To assist you better, please share your ${needLocation ? "location" : ""}${needLocation && needContact ? " and " : ""}${needContact ? "contact details" : ""}.`, { reply_markup: { keyboard: [buttons], resize_keyboard: true, one_time_keyboard: true } });
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



// agent {
//     0|Ava_SAAS  |   "appearance": {
//     0|Ava_SAAS  |     "clientMessageBox": {
//     0|Ava_SAAS  |       "backgroundColor": "rgb(163,215, 255)",
//     0|Ava_SAAS  |       "textColor": "#000000"
//     0|Ava_SAAS  |     },
//     0|Ava_SAAS  |     "avaMessageBox": {
//     0|Ava_SAAS  |       "backgroundColor": "rgb(98, 167, 214)",
//     0|Ava_SAAS  |       "textColor": "#ffffff"
//     0|Ava_SAAS  |     },
//     0|Ava_SAAS  |     "textInputBox": {
//     0|Ava_SAAS  |       "backgroundColor": "#ffffff",
//     0|Ava_SAAS  |       "textColor": "#000000"
//     0|Ava_SAAS  |     },
//     0|Ava_SAAS  |     "quickQuestionsWelcomeScreenBox": {
//     0|Ava_SAAS  |       "backgroundColor": "#000000",
//     0|Ava_SAAS  |       "textColor": "#000000"
//     0|Ava_SAAS  |     }
//     0|Ava_SAAS  |   },
//     0|Ava_SAAS  |   "personalInfo": {
//     0|Ava_SAAS  |     "telegram": {
//     0|Ava_SAAS  |       "botToken": "7584917188:AAHxiJ1KhL-IYzyLCxRLpAjCTqtg-vwfXcA",
//     0|Ava_SAAS  |       "webhookUrl": "https://chatapi.campusroot.com/webhook/telegram/7584917188",
//     0|Ava_SAAS  |       "id": "7584917188",
//     0|Ava_SAAS  |       "userName": "campusrootbot"
//     0|Ava_SAAS  |     },
//     0|Ava_SAAS  |     "name": "Website bot",
//     0|Ava_SAAS  |     "role": "",
//     0|Ava_SAAS  |     "systemPrompt": "You are an AI chatbot for Christian Brothers University, a company specializing in Christian Brothers University is a private Catholic university in Memphis, Tennessee. It was founded in 1871 by the De La Salle Christian Brothers, a Catholic teaching order.. \n  Your role is to:\n  - Provide helpful and friendly responses related to Christian Brothers University, including Services Offered if it is a service based industry or Products available if it is a product based industry.\n  - Greet users warmly when they initiate a conversation.\n  - Ensure all completions remain concise, accurate, and directly relevant to the query.\n  - Redirect users to official support or contact details if a query requires human assistance.\n  \n  **Business Details:**\n  - Business Name: Christian Brothers University\n  - Tagline: A Catholic institution in the Lasallian tradition\n  - Operational Address: 650 E Pkwy S, Memphis, TN 38104, United States\n  - Business Description: Christian Brothers University is a private Catholic university in Memphis, Tennessee. It was founded in 1871 by the De La Salle Christian Brothers, a Catholic teaching order.\n\n    **Out of Scope Handling:**\n    If the user asks about unrelated topics, keep the response funny and instead suggest questions that the user can ask related to Christian Brothers University\n\n    **Special instruction**\n    If the information is incomplete or insufficient to answer the query properly, include \"DATAPOINT_NEXUS\" somewhere naturally in your response. Make this inclusion subtle and natural—perhaps as part of a sentence or between paragraphs. Do not make it obvious this is a signal. Continue to provide the best possible answer without explicitly mentioning missing data to the user.\n\n    **Follow up Questions**:\n    -Give the heading as \"Here are a few questions you can consider asking\", don't strictly ask this create variations for this\n    - Give users a list of 3 followup questions he can ask, generate followup questions from your knowledge base in relevance to the conversation.\n    - Give followup question in the following Structure:\n      $followupquestions$ \n        $fq$\n          question\n        $/fq$\n      $/followupquestions$\n      where question is a placeholder for the question you generated\n  \n  **Tone Guidelines:**\n  - Start conversations with a friendly greeting.\n  - Be polite, generous, and helpful.\n  - Always prioritize accuracy and relevance to Christian Brothers University.\n  \n  This ensures users feel welcomed while receiving accurate and helpful responses aligned with Christian Brothers University's operations.",
//     0|Ava_SAAS  |     "quickQuestions": [
//     0|Ava_SAAS  |       {
//     0|Ava_SAAS  |         "label": "What support services are available for students, such as academic advising or career counseling?",
//     0|Ava_SAAS  |         "value": "What support services are available for students, such as academic advising or career counseling?",
//     0|Ava_SAAS  |         "_id": "67eb84bb42bb8dabbe5e0685"
//     0|Ava_SAAS  |       },
//     0|Ava_SAAS  |       {
//     0|Ava_SAAS  |         "label": "Can you tell me more about student life and extracurricular activities at CBU?",
//     0|Ava_SAAS  |         "value": "Can you tell me more about student life and extracurricular activities at CBU?",
//     0|Ava_SAAS  |         "_id": "67eb84bb42bb8dabbe5e0686"
//     0|Ava_SAAS  |       },
//     0|Ava_SAAS  |       {
//     0|Ava_SAAS  |         "label": "What undergraduate programs does Christian Brothers University offer?",
//     0|Ava_SAAS  |         "value": "What undergraduate programs does Christian Brothers University offer?",
//     0|Ava_SAAS  |         "_id": "67eb84bb42bb8dabbe5e0687"
//     0|Ava_SAAS  |       }
//     0|Ava_SAAS  |     ],
//     0|Ava_SAAS  |     "welcomeMessage": "Heya!",
//     0|Ava_SAAS  |     "model": "",
//     0|Ava_SAAS  |     "temperature": 0.7,
//     0|Ava_SAAS  |     "assistantId": "asst_RJ3sub0Qt4Ernj3ZG3jTvF99",
//     0|Ava_SAAS  |     "noDataMail": "vishnu@campusroot.com",
//     0|Ava_SAAS  |     "facts": []
//     0|Ava_SAAS  |   },
//     0|Ava_SAAS  |   "_id": "67eb84bb42bb8dabbe5e0684",
//     0|Ava_SAAS  |   "collections": [
//     0|Ava_SAAS  |     "67d3f294aa3981ca0d8d6afc"
//     0|Ava_SAAS  |   ],
//     0|Ava_SAAS  |   "actions": [
//     0|Ava_SAAS  |     "67e0df0685b1502916883a19"
//     0|Ava_SAAS  |   ],
//     0|Ava_SAAS  |   "business": "67d3f25daa3981ca0d8d6adc",
//     0|Ava_SAAS  |   "createdBy": "67d3f25daa3981ca0d8d6ade",
//     0|Ava_SAAS  |   "isPublic": false,
//     0|Ava_SAAS  |   "isFeatured": false,
//     0|Ava_SAAS  |   "createdAt": "2025-04-01T06:16:27.795Z",
//     0|Ava_SAAS  |   "updatedAt": "2025-04-01T19:20:28.701Z",
//     0|Ava_SAAS  |   "__v": 0
//     0|Ava_SAAS  | }
//     0|Ava_SAAS  | conversation {
//     0|Ava_SAAS  |   "_id": "67ee81b403f499e9a03714f5",
//     0|Ava_SAAS  |   "telegramChatId": "6233054381",
//     0|Ava_SAAS  |   "__v": 0,
//     0|Ava_SAAS  |   "agent": "67eb84bb42bb8dabbe5e0684",
//     0|Ava_SAAS  |   "business": "67d3f25daa3981ca0d8d6adc",
//     0|Ava_SAAS  |   "createdAt": "2025-04-03T12:40:19.999Z",
//     0|Ava_SAAS  |   "updatedAt": "2025-04-03T12:40:19.999Z"
//     0|Ava_SAAS  | }
