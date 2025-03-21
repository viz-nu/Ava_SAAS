import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import ExpressMongoSanitize from "express-mongo-sanitize";
import { initialize } from "./utils/dbConnect.js";
import { indexRouter } from "./routers/index.js";
import errorHandlerMiddleware from "./middleware/errorHandler.js";
import { emailConformation } from "./controllers/auth/register.js";
import { actions, AssistantResponse, ChatCompletion, getContextMain } from "./utils/openai.js";
import { Agent } from "./models/Agent.js";
import { Business } from "./models/Business.js";
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
import { createServer } from "http";
import { initializeSocket, io } from "./utils/io.js";
await initialize();
const app = express();
const server = createServer(app); // Create HTTP server
await initializeSocket(server);
app.set('trust proxy', 1) // trust first proxy
const whitelist = ["https://www.avakado.ai", "http://localhost:5174", "https://avakado.ai"];
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl requests)
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    credentials: true,
    optionsSuccessStatus: 204,
    preflightContinue: false
};

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json({ type: ["application/json", "text/plain"], limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet({
    contentSecurityPolicy: false, // Temporarily disable CSP
    frameguard: { action: 'sameorigin' },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Add this line
    crossOriginOpenerPolicy: false, // Add this line
    crossOriginEmbedderPolicy: false // Add this line
}));
app.use(ExpressMongoSanitize());
app.use(morgan(':date[web] :method :url :status :res[content-length] - :response-time ms'));
app.use(express.json());
app.get("/", (req, res) => res.send("Server up and running"));
app.get("/email/confirmation", emailConformation)
app.use("/api/v1", indexRouter)
app.use("/webhook", webhookRouter)
app.post('/v2/chat-bot', async (req, res) => {
    try {
        const { userMessage, agentId, streamOption = false, conversationId, geoLocation = {} } = req.body;
        let [agent, business, conversation] = await Promise.all([
            Agent.findById(agentId).populate("actions"),
            Business.findOne({ agents: agentId }),
            conversationId ? Conversation.findById(conversationId) : null
        ]);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        if (!business) return res.status(404).json({ error: 'Business not found' });
        let prevMessages = [];
        if (conversation) {
            const messages = await Message.find({ conversationId }).select("query response");
            prevMessages.push(...messages.flatMap(({ query, response }) => [
                { role: "user", content: query },
                { role: "assistant", content: response }
            ]));
        } else {
            conversation = await Conversation.create({ business: business._id, agent: agentId, geoLocation: geoLocation.data });
        }
        prevMessages.push({ role: "user", content: userMessage });
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
        const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions);
        const message = await Message.create({ business: business._id, query: userMessage, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
        let tasks = matchedActions.map(async ({ intent, dataSchema, confidence }) => {
            if (intent == "enquiry") {
                const { data = userMessage } = dataSchema.find(ele => ele.key == "Topic") || {}
                const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
                let systemPrompt = (agent.personalInfo.systemPrompt || "") + `Context: ${answer}
                Like an intelligent and interactive AI assistant, Use the provided context to generate clear, precise, and well-structured responses.
                If the retrieved data sufficiently answers the query, deliver a concise and direct response.
                If the information is incomplete or insufficient to properly answer the query, include the phrase "DATAPOINT_NEXUS" somewhere naturally in your response. Make this inclusion subtle and natural - perhaps as part of a sentence or between paragraphs. Do not make it obvious this is a signal. Continue to provide the best possible answer without explicitly mentioning missing data to the user.
                Keep the conversation interactive by:
                 -Asking follow-up questions to clarify user intent.
                 -Gathering relevant user details (e.g., name, contact preferences, or specific requirements) when appropriate.
                 -Suggesting related topics or next steps based on the context.
                If external links are available, include them naturally within the response.`
                prevMessages.unshift({ role: "system", content: systemPrompt });
                let config = { streamOption, prevMessages, model: "gpt-4", messageId: message._id, conversationId: conversation._id }
                const { responseTokens, response, signalDetected } = await ChatCompletion(req, res, config)
                message.responseTokens = responseTokens
                message.response = response
                message.embeddingTokens = embeddingTokens
                message.context = context
                if (signalDetected) {
                    // Queue notification asynchronously (don't wait for it)
                    // notifyDeveloper(msg.query, "Insufficient data detected").catch(console.error);
                }
            }
            else if (intent == "general_chat") {
                let systemPrompt = (agent.personalInfo.systemPrompt)
                prevMessages.unshift({ role: "system", content: systemPrompt });
                let config = { streamOption, prevMessages, model: "gpt-4o-mini", messageId: message._id, conversationId: conversation._id, temperature: 1 }
                const { responseTokens, response } = await ChatCompletion(req, res, config)
                message.responseTokens = responseTokens
                message.response = response
            }
            else {
                const currentAction = agent.actions.find(ele => intent == ele.intent)
                currentAction.dataSchema = currentAction.dataSchema.map(schemaItem => { const matchingData = dataSchema.find(dataItem => dataItem.label === schemaItem.label); return { ...schemaItem, data: matchingData ? matchingData.data : null }; });
                res.write(JSON.stringify({ id: "data-collection", data: { action: currentAction._doc, confidence }, responseType: "full" }))
                message.Actions.push({ type: "data-collection", data: { action: currentAction._doc, confidence }, confidence })
            }
        })
        await Promise.all(tasks);
        await message.save()
        return res.end(JSON.stringify({ id: "end" }))
    } catch (error) {
        console.error(error);
        return res.end(JSON.stringify({ id: "error" }))
    }
});
app.post('/v1/agent', async (req, res) => {
    try {
        const { userMessage, agentId, streamOption = false, conversationId, geoLocation = {} } = req.body;
        let [agent, business, conversation] = await Promise.all([
            Agent.findById(agentId).populate("actions"),
            Business.findOne({ agents: agentId }),
            conversationId ? Conversation.findById(conversationId) : null
        ]);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });
        if (!business) return res.status(404).json({ error: 'Business not found' });
        let prevMessages = [];
        if (conversation) {
            const messages = await Message.find({ conversationId }).select("query response");
            prevMessages.push(...messages.flatMap(({ query, response }) => {
                const entries = [];
                if (query) entries.push({ role: "user", content: query });
                if (response) entries.push({ role: "assistant", content: response });
                return entries;
            }));

        } else {
            conversation = await Conversation.create({ business: business._id, agent: agentId, geoLocation: geoLocation.data });
        }
        prevMessages.push({ role: "user", content: userMessage });
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
        const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions); const message = await Message.create({ business: business._id, query: userMessage, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
        let tasks = matchedActions.map(async ({ intent, dataSchema, confidence }) => {
            if (intent == "enquiry") {
                const { data = userMessage } = dataSchema.find(ele => ele.key == "Topic") || {}
                const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
                let config = { additional_instructions: `Today:${new Date()} \n Context: ${answer || null}`, assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id }
                const { responseTokens, response, signalDetected } = await AssistantResponse(req, res, config)
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
                        sendMail({ to: agent.personalInfo.noDataMail, subject: "Urgent: Missing information for AVA", text, html })
                        res.json({ message: 'mail sent' });
                    } catch (error) {
                        console.error(error);
                        return res.status(500).json({ error: error.message })
                    }
                }
            }
            else if (intent == "general_chat") {
                let config = { assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id }
                const { responseTokens, response } = await AssistantResponse(req, res, config)
                message.responseTokens = responseTokens
                message.response = response
            }
            else {
                const currentAction = agent.actions.find(ele => intent == ele.intent)
                const dataMap = new Map();
                dataSchema.forEach(item => { dataMap.set(item.key, item.data) });
                let respDataSchema = populateStructure(currentAction._doc.workingData.body, dataMap);
                res.write(JSON.stringify({ id: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence }, responseType: "full", conversationId: conversation._id }))
                message.Actions.push({ type: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence } })
            }
        })
        await Promise.all(tasks);
        await message.save()
        return res.end(JSON.stringify({ id: "end" }))
    } catch (error) {
        console.error(error);
        return res.end(JSON.stringify({ id: "error" }))
        // res.status(500).json({ error: error.message });
    }
});
app.post("/trigger", async (req, res) => {
    try {
        const { actionId, collectedData, conversationId } = req.body
        const action = await Action.findById(actionId);
        if (!action) return res.status(404).json({ message: "Action not found" });
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });
        await updateSession(conversationId, { actionId, collectedData })
        let body = await dataBaker(action.workingData.body, actionId, conversationId)
        console.log(action.workingData.body);
        
        let headers = await dataBaker(action.workingData.headers, actionId, conversationId)
        let url = await dataBaker(action.workingData.url, actionId, conversationId)
        return res.status(200).json({ success: true, message: "received submit request", data: { body, headers, url } })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "internal server error", error: err.message });
    }
})
app.put("/reaction", async (req, res) => {
    const { messageId, reaction } = req.body;
    // Validation for messageId and reaction
    if (!messageId || !reaction) return res.status(400).json({ message: "Message ID and reaction are required" });
    if (!["neutral", "like", "dislike"].includes(reaction)) return res.status(400).json({ message: "Undefined reaction" });
    try {
        // Assuming messageId is the _id of the document in the database
        const updatedMessage = await Message.findByIdAndUpdate(messageId, { $set: { reaction: reaction } }, { new: true });
        if (!updatedMessage) return res.status(404).json({ message: "Message not found" });
        return res.status(200).json({ success: true, message: "message updated" });
    } catch (err) {
        return res.status(500).json({ message: "An error occurred", error: err.message });
    }
});
app.get("/get-agent", async (req, res) => {
    try {
        const { agentId } = req.query
        const agent = await Agent.findById(agentId).populate("business")
        if (!agent) return res.status(404).json({ message: 'Agent not found' });
        res.status(200).json({ success: true, data: agent });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred", error: error.message });
    }
})
import ical, { ICalCalendarMethod } from 'ical-generator';
import { sendMail } from "./utils/sendEmail.js";
import { webhookRouter } from "./webhooks/index.js";
import { dataBaker, populateStructure, updateSession } from "./utils/tools.js";
import { Action } from "./models/Action.js";
import { DateTime } from "luxon";
app.post('/send-invite', async (req, res) => {
    try {
        const { host, attendees, startTime, timezone, summary, description, location, url } = req.body;
        attendees = attendees.push(host)
        if (!attendees || !host) return res.status(400).json({ error: 'attendee or host' });
        if (!startTime) return res.status(400).json({ error: 'Start time required' });
        const calendar = ical({ name: 'Appointment Invitation' });
        calendar.method(ICalCalendarMethod.REQUEST);
        let endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30);
        calendar.createEvent({
            start: new Date(startTime),
            end: new Date(endTime),
            timezone: timezone || DateTime.fromISO(new Date(startTime), { setZone: true }).zoneName,
            organizer: { name: 'AVA', email: 'no-reply@ava.com' },
            summary: summary || 'Meeting Invitation',
            description: description || 'You are invited to a meeting.',
            location: location || 'Online',
            url: url || 'http://example.com',
            attendees: attendees.map(email => ({ email }))
        });
        await sendMail({
            to: attendees.join(','),
            subject: 'Appointment Schedule Invitation',
            text: `You are invited to a meeting. Summary: ${summary}`,
            html: `<div style="font-family: Arial, sans-serif; color: #333;">
                  <h2>You are invited to a meeting</h2>
                  <p><strong>Summary:</strong> ${summary}</p>
                  <p><strong>Description:</strong> ${description}</p>
                  <p><strong>Location:</strong> ${location}</p>
                  <p><strong>Time:</strong> ${new Date(startTime).toUTCString()} - ${new Date(endTime).toUTCString()} (${timezone})</p>
                  <p><a href="${url}" style="color: blue;">Join Meeting</a></p>
               </div>`,
            attachments: [{
                filename: 'invite.ics',
                content: calendar.toString(),
                contentType: 'text/calendar'
            }]
        })
        res.json({ message: 'Invitation sent' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message })
    }
});
app.post('/send-mail', async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;
        await sendMail({
            to: to,
            subject: subject,
            text: text,
            html: html
        })
        res.json({ message: 'mail sent' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message })
    }
})

app.use("/*", (req, res) => res.status(404).send("Route does not exist"))
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
