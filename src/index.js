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
import { actions, AssistantResponse, getContextMain } from "./utils/openai.js";
import { AgentModel } from "./models/Agent.js";
import { Business } from "./models/Business.js";
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
import { createServer } from "http";
import { initializeSocket, io } from "./utils/io.js";
import ical, { ICalCalendarMethod } from 'ical-generator';
import { sendMail } from "./utils/sendEmail.js";
import { webhookRouter } from "./webhooks/index.js";
import { createToolWrapper, dataBaker, generateMeetingUrl, populateStructure, updateSession } from "./utils/tools.js";
import { Action } from "./models/Action.js";
import { DateTime } from "luxon";
import { Lead } from "./models/Lead.js";
import { Agent, run, RunState, tool } from '@openai/agents';
import { StreamEventHandler } from "./utils/streamHandler.js";
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
const openCors = cors({
    origin: true, // Reflect request origin
    credentials: true,
});
app.get("/", cors(corsOptions), (req, res) => res.send("Server up and running"));
app.get("/email/confirmation", cors(corsOptions), emailConformation);
app.use("/api/v1", cors(corsOptions), indexRouter);
app.use("/webhook", cors(corsOptions), webhookRouter);
app.options('/v1/agent', openCors);
app.options('/trigger', openCors);
app.options('/reaction', openCors);
app.options('/get-agent', openCors);
app.options('/send-invite', openCors);
app.options('/send-mail', openCors);
// app.post('/v1/agent', openCors, async (req, res) => {
//     try {
//         const { userMessage, agentId, streamOption = false, conversationId, geoLocation = {} } = req.body;
//         let [agent, business, conversation] = await Promise.all([
//             AgentModel.findById(agentId).populate("actions"),
//             Business.findOne({ agents: agentId }),
//             conversationId ? Conversation.findById(conversationId) : null
//         ]);
//         if (!agent) return res.status(404).json({ error: 'Agent not found' });
//         if (!business) return res.status(404).json({ error: 'Business not found' });
//         let prevMessages = [];
//         if (conversation) {
//             const messages = await Message.find({ conversationId }).select("query response");
//             prevMessages.push(...messages.flatMap(({ query, response }) => {
//                 const entries = [];
//                 if (query) entries.push({ role: "user", content: query });
//                 if (response) entries.push({ role: "assistant", content: response });
//                 return entries;
//             }));

//         } else {
//             conversation = await Conversation.create({ business: business._id, agent: agentId, geoLocation: geoLocation.data });
//         }
//         prevMessages.push({ role: "user", content: userMessage });
//         let listOfIntentions = [{
//             "intent": "enquiry",
//             "dataSchema": [{
//                 "key": "Topic",
//                 "type": "dynamic",
//                 "dataType": "string",
//                 "required": true,
//                 "comments": "General information requests. The subject of the enquiry (e.g., services, products, policies).",
//                 "validator": "",
//                 "data": "",
//                 "userDefined": true
//             }]
//         },
//         {
//             "intent": "general_chat", "dataSchema": [{
//                 "key": "Message",
//                 "type": "dynamic",
//                 "dataType": "string",
//                 "required": true,
//                 "comments": "A general conversational message from the user.",
//                 "validator": "",
//                 "data": "",
//                 "userDefined": true
//             }]
//         }]
//         listOfIntentions.push(...agent.actions.filter(action => action.intentType === "Query").map(({ intent, workingData }) => ({ intent, dataSchema: workingData.body })));
//         const { matchedActions, model, usage } = await actions(prevMessages, listOfIntentions);
//         const message = await Message.create({ business: business._id, query: userMessage, response: "", analysis: matchedActions, analysisTokens: { model, usage }, embeddingTokens: {}, responseTokens: {}, conversationId: conversation._id, context: [], Actions: [], actionTokens: {} });
//         let tasks = matchedActions.map(async ({ intent, dataSchema, confidence }) => {
//             if (intent == "enquiry") {
//                 const { data = userMessage } = dataSchema.find(ele => ele.key == "Topic") || {}
//                 const { answer, context, embeddingTokens } = await getContextMain(agent.collections, data);
//                 let config = {
//                     additional_instructions: `Today:${new Date()} \n Context: ${answer || null}
// **DATA COMPLETENESS PROTOCOL - CRITICAL:**
// When you do not have enough information to provide a complete and accurate answer to ANY query, you MUST begin your response with exactly "DATAPOINT_NEXUS" followed by your regular response. This applies to:
// - Any specific information not included in the context provided
// - Questions where context is missing, incomplete, or unclear
// - Requests for details that would require additional data
// - Any query where you cannot give a confident and complete answer
// Example:
// User: "What is the history of..."
// Your response: "DATAPOINT_NEXUS Hello! I don't have specific information about the history you're asking about. However, I can tell you that... [continue with what you do know]"
// `,
//                     assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, signalKeyword: "DATAPOINT_NEXUS", streamOption
//                 }
//                 const { responseTokens, response, signalDetected } = await AssistantResponse(req, res, config)
//                 if (!streamOption) res.write(JSON.stringify({ id: "conversation", messageId: message._id, conversationId: conversation._id, responseType: "chunk", data: response }));
//                 message.responseTokens = responseTokens
//                 message.response = response
//                 message.embeddingTokens = embeddingTokens
//                 message.context = context
//                 if (signalDetected && agent.personalInfo.noDataMail) {
//                     try {
//                         console.log("sending mail", { to: agent.personalInfo.noDataMail, topic: data });
//                         let text = `Dear [Support Team],
//                         While interacting with the chatbot, it failed to fetch content related to "${data}". This issue is affecting the user experience and needs immediate attention.
//                         User Query:
//                         "${userMessage}"
//                         RAG Model Retrieved Context:
//                         ${answer || "No context retrieved or context was empty."}
//                         Please investigate and resolve the issue as soon as possible.
//                         Best regards,
//                         Team Avakado`
//                         let html = `<!DOCTYPE html>
//                         <html>
//                         <head>
//                         <meta charset="UTF-8">
//                         <title>Chatbot Content Fetch Issue</title>
//                         <style>
//                         body {
//                             font-family: Arial, sans-serif;
//                             background-color: #f4f4f4;
//                             padding: 20px;
//                             }
//                         .container {
//                         background: #ffffff;
//                         padding: 20px;
//                         border-radius: 8px;
//                         box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
//                         }
//                         h2 {
//                             color: #d9534f;
//                         }
//                         p {
//                             color: #333;
//                         }
//                         .footer {
//                             margin-top: 20px;
//                             font-size: 12px;
//                             color: #777;
//                         }
//                         </style>
//                         </head>
//                         <body>
//                         <div class="container">
//                         <p>Dear <strong>Support Team</strong>,</p>
//                         <p>While interacting with the chatbot, it failed to retrieve content related to <strong>${data}</strong>. This issue is impacting the user experience and requires immediate attention.</p>
//                         <p><strong>User Query:</strong></p>
//                         <div class="code-block">${userMessage}</div>
//                         <p><strong>RAG Model Retrieved Context:</strong></p>
//                         <div class="code-block">${answer || "No context retrieved or context was empty."}</div>
//                         <p>Please investigate and resolve the issue as soon as possible.</p>
//                         <p>Best regards,</p>
//                         <p><strong>Team Avakado</strong><br>
//                         <div class="footer">
//                             <p>This is an automated email. Please do not reply directly.</p>
//                         </div>
//                         </div>
//                         </body>
//                         </html>`
//                         await sendMail({ to: agent.personalInfo.noDataMail, subject: "Urgent: Missing information for AVA", text, html })
//                         return res.end(JSON.stringify({ id: "end" }))
//                     } catch (error) {
//                         console.error(error);
//                         return res.status(500).json({ error: error.message })
//                     }
//                 }
//             }
//             else if (intent == "general_chat") {
//                 let config = { assistant_id: agent.personalInfo.assistantId, prevMessages, messageId: message._id, conversationId: conversation._id, streamOption }
//                 const { responseTokens, response } = await AssistantResponse(req, res, config)
//                 if (!streamOption) res.write(JSON.stringify({ id: "conversation", messageId: message._id, conversationId: conversation._id, responseType: "chunk", data: response }));
//                 message.responseTokens = responseTokens
//                 message.response = response
//             }
//             else {
//                 const currentAction = agent.actions.find(ele => intent == ele.intent)
//                 const dataMap = new Map();
//                 dataSchema.forEach(item => { dataMap.set(item.key, item.data) });
//                 let respDataSchema = populateStructure(currentAction._doc.workingData.body, dataMap);
//                 res.write(JSON.stringify({ id: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence }, responseType: "full", conversationId: conversation._id }))
//                 message.Actions.push({ type: "data-collection", data: { actionId: currentAction._doc._id, intent, dataSchema: respDataSchema, confidence } })
//             }
//         })
//         await Promise.all(tasks);
//         await message.save()
//         return res.end(JSON.stringify({ id: "end" }))
//     } catch (error) {
//         console.error(error);
//         return res.end(JSON.stringify({ id: "error" }))
//         // res.status(500).json({ error: error.message });
//     }
// });
app.post('/v1/agent', openCors, async (req, res) => {
    const handler = new StreamEventHandler();
    try {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        const { userMessage, agentId, conversationId, geoLocation = {}, messageId, interruptionDecisions = [] } = req.body;
        let [agentDetails, business, conversation, message] = await Promise.all([AgentModel.findById(agentId).populate("actions"), Business.findOne({ agents: agentId }), conversationId ? Conversation.findById(conversationId) : null, messageId ? Message.findById(messageId) : null]);
        if (!agentDetails) return res.status(404).json({ error: 'Agent not found' });
        if (!business) return res.status(404).json({ error: 'Business not found' });
        let prevMessages = [], state
        if (conversation) {
            const messages = await Message.find({ conversationId }).select("query response");
            prevMessages.push(...messages.flatMap(({ query, response }) => {
                const entries = [];
                if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                return entries;
            }));
        } else { conversation = await Conversation.create({ business: business._id, agent: agentId, geoLocation: geoLocation.data }); }
        if (!message) message = await Message.create({ business: business._id, query: userMessage, response: "", conversationId: conversation._id });
        prevMessages.push({ role: "user", content: [{ type: "input_text", text: message.query }] });
        const toolsJson = agentDetails.tools?.map(ele => (tool(createToolWrapper(ele)))) || agentDetails.actions?.map(ele => (tool(createToolWrapper(ele)))) || [];
        const agent = new Agent({ name: agentDetails.personalInfo.name, instructions: agentDetails.personalInfo.systemPrompt, model: agentDetails.personalInfo.model, toolChoice: 'auto', temperature: agentDetails.personalInfo.temperature, tools: toolsJson });
        if (interruptionDecisions.length > 0) {
            state = await RunState.fromString(agent, conversation.state);
            for (const decision of interruptionDecisions) {
                const interruption = conversation.pendingInterruptions.find(ele => ele.rawItem.id == decision.id);
                if (interruption) (decision.action === 'approve') ? state.approve(interruption) : state.reject(interruption)
            }
            conversation = await Conversation.findByIdAndUpdate(conversationId, { $set: { pendingInterruptions: [], state: "" } }, { new: true });
        } else { state = prevMessages }
        let stream = await run(agent, state, { stream: true });
        let hasInterruptions = false;
        do {
            for await (const delta of stream) {
                const processed = handler.handleEvent(delta);
                if (!processed) continue;
                if (processed.type === 'stream_complete') break;
                const payload = { id: "", messageId: message._id, conversationId: conversation._id, responseType: "full", data: null };
                switch (processed.type) {
                    case 'response_started':
                        // console.log('🚀 Response started:', processed.message);
                        break;
                    case 'function_call':
                        message.triggeredActions.push(processed.functionCall?.name);
                        break;
                    case 'function_output':
                        // payload.id = "responseFromAction";
                        // payload.data = processed.result?.output;
                        // res.write(JSON.stringify(payload) );
                        break;
                    case 'text_delta':
                        payload.id = "conversation";
                        payload.data = processed.delta;
                        payload.responseType = "chunk";
                        res.write(JSON.stringify(payload));
                        break;
                    case 'text_done':
                        // console.log('\n✅ Text completed');
                        break;
                    case 'stream.complete':
                        console.log('🏁 Stream finished');
                        break;
                    case 'response_done':
                        console.log('🎉 Response completed');
                        message.response = processed.response.finalOutput[0]?.content[0]?.text || JSON.stringify(processed.response.finalOutput);
                        message.responseTokens.model = processed.response.model
                        message.responseTokens.usage = processed.response.usage
                        break;
                    case 'error':
                        payload.id = "error";
                        payload.data = processed.error;
                        res.write(JSON.stringify(payload));
                        break;
                }
                res.flush?.(); // flush buffer if supported
            }
            const newState = stream.state;
            if (stream.interruptions?.length) {
                hasInterruptions = true;
                const interruptionData = stream.interruptions.map(interruption => ({ ...interruption, timestamp: new Date(), status: 'pending' }));
                conversation = await Conversation.findByIdAndUpdate(conversation._id, { $set: { pendingInterruptions: interruptionData, state: JSON.stringify(newState) } }, { new: true });
                const interruptionPayload = { id: "interruptions_pending", conversationId: conversation._id, messageId: message._id, responseType: "interruption", data: { interruptions: interruptionData.map(({ rawItem, type, message }) => ({ rawItem: { ...rawItem, parameters: agentDetails.tools.length > 0 ? agentDetails.tools.find(ele => ele.name === rawItem.name).parameters : agentDetails.actions.find(ele => ele.intent === rawItem.name) }, type: type, message: message })) } };
                res.write(JSON.stringify(interruptionPayload));
                break;
            } else {
                break;
            }
        } while (true);
        await message.save()
        return !hasInterruptions ? res.end(JSON.stringify({ id: "end" })) : res.end(JSON.stringify({ id: "awaiting_approval", conversationId, messageId: message._id, message: "Waiting for user approval of pending actions" }))
    } catch (error) {
        console.error('Agent error:', error);
        res.write(JSON.stringify({ id: "error", responseType: "full", data: error.message }));
        return res.end(JSON.stringify({ id: "end" }));
    }
});
app.post('/fetch-from-db', openCors, async (req, res) => {
    try {
        const { query, collections } = req.query;
        if (!query.trim()) return res.json({ success: false, message: 'empty query', data: null });
        if (collections.length < 1) return res.json({ success: false, message: 'empty collection', data: null });
        const { answer } = await getContextMain(collections, query);
        return res.json({ success: true, message: 'summary of what is in the knowledge base', data: answer });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message, message: 'Internal server error' });
    }
})
app.post('/v1/agent-executer', openCors, async (req, res) => {
    let functionString = `
            console.log(input.company_name, input.preferred_time, input.contact_email)
            if(!input.company_name || !input.preferred_time || !input.contact_email) {
                throw new Error('Missing required fields: company name, preferred time and contact email are all required')
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRegex.test(input.contact_email)) {
                throw new Error('Invalid email format provided')
            }
            // Validate date format
            const date = new Date(input.preferred_time);
            if(isNaN(date.getTime())) {
                throw new Error('Invalid date format. Please use ISO format like 2024-01-01T14:00:00Z')
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            return \`A slot has been booked with the \${input.company_name} team at \${input.preferred_time}. Confirmation sent to \${input.contact_email}.\`;
        `, errorFunction = `
            console.error('Deal booking failed:', input);
            return 'I apologize, but I encountered an error while booking your meeting slot. Please check your details and try again, or contact our support team for assistance.';
        `, { input } = req.body
    let fnToBeExecuted = `
        "use strict";
        ${functionString}
    `;
    const ErrorFnToBeExecuted = `
        "use strict";
        ${errorFunction}
    `
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    let mainFn = new AsyncFunction('input', fnToBeExecuted), errorFn = new AsyncFunction('input', ErrorFnToBeExecuted);
    try {
        const result = await mainFn(input);
        return res.status(200).json({ success: true, result });
    } catch (err) {
        console.error('Execution error:', err);
        try {
            if (errorFunction?.trim()) {
                const fallback = await errorFn(input);
                return res.status(400).json({ success: false, error: err.message, message: fallback });
            }
            return res.status(500).json({ success: false, error: err.message, message: err.message });
        } catch (innerErr) {
            console.error('Error in fallback function:', innerErr);
            return res.status(500).json({ success: false, error: 'Unexpected server error.' });
        }
    }
})
app.post("/trigger", openCors, async (req, res) => {
    try {
        const { actionId, collectedData, conversationId } = req.body
        const action = await Action.findById(actionId);
        if (!action) return res.status(404).json({ message: "Action not found" });
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });
        await updateSession(conversationId, { actionId, collectedData })
        let body = await dataBaker(action.workingData.body, actionId, conversationId)
        let headers = await dataBaker(action.workingData.headers, actionId, conversationId)
        let url = await dataBaker(action.workingData.url, actionId, conversationId)
        return res.status(200).json({ success: true, message: "received submit request", data: { body: body.body, headers, url: url.url, accessType: action?.accessType, method: action?.workingData?.method } })
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "internal server error", error: error.message });
    }
})
app.put("/reaction", openCors, async (req, res) => {
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
app.get("/get-agent", openCors, async (req, res) => {
    try {
        const { agentId } = req.query
        const agent = await AgentModel.findById(agentId).populate("business")
        if (!agent) return res.status(404).json({ message: 'Agent not found' });
        res.status(200).json({ success: true, data: agent });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred", error: error.message });
    }
})
app.post('/send-invite', openCors, async (req, res) => {
    try {
        let { host, attendees, startTime, timezone, summary = "Meeting Invitation", description = "You are invited to a meeting.", location = "Online", url = generateMeetingUrl("Invitation") } = req.body;
        if (!attendees || !host) return res.status(400).json({ error: 'attendee or host' });
        if (!startTime) return res.status(400).json({ error: 'Start time required' });
        attendees = [attendees, host]
        const calendar = ical({ name: 'Appointment Invitation' });
        calendar.method(ICalCalendarMethod.REQUEST);
        let endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + 30);
        calendar.createEvent({
            start: new Date(startTime),
            end: new Date(endTime),
            timezone: timezone || DateTime.fromISO(new Date(startTime), { setZone: true }).zoneName,
            organizer: { name: 'AVA', email: 'no-reply@ava.com' },
            summary: summary,
            description: description,
            location: location,
            url: url,
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
        res.status(200).json({ success: true, message: 'Appointment Scheduled Successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message })
    }
});
app.post('/send-mail', openCors, async (req, res) => {
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
app.post('/contact-us', openCors, async (req, res) => {
    try {
        const { name, contactDetails, purpose } = req.body;
        if (!name || !contactDetails || !purpose) return res.status(400).json({ error: 'Missing required fields' });
        const { email, phone } = contactDetails;
        if (!email && !phone) return res.status(400).json({ error: 'At least one contact detail (email or phone) is required' });
        const subject = `New Contact Request from ${name}`;
        const text = ` New contact form submission:
                        Name: ${name}
                        Email: ${email || 'N/A'}
                        Phone: ${phone || 'N/A'}
                        Purpose: ${purpose}`.trim();
        const html = `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email || 'N/A'}</p>
            <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
            <p><strong>Purpose:</strong><br>${purpose}</p>
        `;
        Promise.all([
            await Lead.create({ name, purpose, contactDetails: { email: email || null, phone: phone || null } }),
            await sendMail({ to: "ankit@onewindow.co anurag@onewindow.co vishnu.teja101.vt@gmail.com", subject, text, html })
        ]);
        return res.json({ success: true, message: 'we will get back to you soon', data: null });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message, message: 'Internal server error' });
    }
})
app.use("/*", (req, res) => res.status(404).send("Route does not exist"))
app.use(errorHandlerMiddleware);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
