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
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
import { createServer } from "http";
import { initializeSocket, io } from "./utils/io.js";
import ical, { ICalCalendarMethod } from 'ical-generator';
import { sendEmail, sendMail } from "./utils/sendEmail.js";
import { webhookRouter } from "./webhooks/index.js";
import { createToolWrapper, dataBaker, generateMeetingUrl, populateStructure, updateSession } from "./utils/tools.js";
import { Action } from "./models/Action.js";
import { DateTime } from "luxon";
import { Lead } from "./models/Lead.js";
import { Agent, run, RunState, tool } from '@openai/agents';
import { StreamEventHandler } from "./utils/streamHandler.js";
import { Ticket } from "./models/Tickets.js";
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
app.use("/webhook", webhookRouter);
app.options('/v1/agent', openCors);
app.options('/trigger', openCors);
app.options('/reaction', openCors);
app.options('/get-agent', openCors);
app.options('/send-invite', openCors);
app.options('/send-mail', openCors);
app.post('/v1/agent', openCors, async (req, res) => {
    const handler = new StreamEventHandler();
    const totals = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
    try {
        const { userMessage, agentId, conversationId, geoLocation = {}, messageId, interruptionDecisions = [] } = req.body;
        let [agentDetails, conversation, message] = await Promise.all([AgentModel.findById(agentId).populate("actions business"), conversationId ? Conversation.findById(conversationId) : null, messageId ? Message.findById(messageId) : null]);
        if (!agentDetails) return res.status(404).json({ error: 'Agent not found' });
        let prevMessages = [], state
        if (conversation) {
            const messages = await Message.find({ conversationId }).select("query response");
            prevMessages.push(...messages.flatMap(({ query, response }) => {
                const entries = [];
                if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                return entries;
            }));
        } else { conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentId, geoLocation: geoLocation.data }); }
        if (!message) message = await Message.create({ business: agentDetails.business._id, query: userMessage, response: "", conversationId: conversation._id });
        prevMessages.push({ role: "user", content: [{ type: "input_text", text: message.query }] });
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.flushHeaders();
        const write = chunk => res.write(JSON.stringify(chunk));
        const toolsJson = agentDetails.actions?.map(ele => (tool(createToolWrapper(ele)))) || [];
        const agent = new Agent({
            name: agentDetails.personalInfo.name,
            instructions: agentDetails.personalInfo.systemPrompt,
            model: agentDetails.personalInfo.model,
            toolChoice: 'auto',
            temperature: agentDetails.personalInfo.temperature,
            tools: toolsJson,
        });
        if (interruptionDecisions.length > 0) {
            state = await RunState.fromString(agent, conversation.state);
            for (const decision of interruptionDecisions) {
                const interruption = conversation.pendingInterruptions.find(ele => ele.rawItem.id == decision.id);
                if (interruption) (decision.action === 'approve') ? state.approve(interruption) : state.reject(interruption)
            }
            conversation = await Conversation.findByIdAndUpdate(conversationId, { $set: { pendingInterruptions: [], state: "" } }, { new: true });
        } else { state = prevMessages }
        let hasInterruptions = false;
        const stream = await run(agent, state, { stream: true })
        do {
            for await (const delta of stream) {
                if (
                    delta?.data?.type === "model" &&
                    delta?.data?.event?.type === "response.completed" &&
                    delta?.data?.event?.response?.usage
                ) {
                    const usage = delta.data.event.response.usage;
                    totals.input_tokens += usage.input_tokens ?? 0;
                    totals.output_tokens += usage.output_tokens ?? 0;
                    totals.total_tokens += usage.total_tokens ?? 0;
                }
                const processed = handler.handleEvent(delta);
                if (!processed) continue;
                if (processed.type === "stream_complete" || delta.done === true) break;
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
                        write(payload);
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
                        message.responseTokens.usage = totals
                        break;
                    case 'error':
                        payload.id = "error";
                        payload.data = processed.error;
                        write(payload);
                        break;
                }
            }
            const newState = stream.state;
            if (stream.interruptions?.length) {
                hasInterruptions = true;
                const interruptionData = stream.interruptions.map(interruption => ({ ...interruption, timestamp: new Date(), status: 'pending' }));
                conversation = await Conversation.findByIdAndUpdate(conversation._id, { $set: { pendingInterruptions: interruptionData, state: JSON.stringify(newState) } }, { new: true });
                const interruptionPayload = { id: "interruptions_pending", conversationId: conversation._id, messageId: message._id, responseType: "interruption", data: { interruptions: interruptionData.map(({ rawItem, type, message }) => ({ rawItem: { ...rawItem, parameters: agentDetails.actions.find(ele => ele.intent === rawItem.name) }, type: type, message: message })) } };
                write(interruptionPayload);
                break;
            } else {
                break;
            }
        } while (true);
        await message.save()
        !hasInterruptions ? res.end(JSON.stringify({ id: "end" })) : res.end(JSON.stringify({ id: "awaiting_approval", conversationId, messageId: message._id, message: "Waiting for user approval of pending actions" }))
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
        const { meetingDetails = {}, attendees = [], organizerDetails = {} } = req.body;
        // attendees must be an array of senders
        if (!Array.isArray(attendees) || attendees.length === 0) return res.status(400).json({ error: 'Attendees must be a non-empty array' });
        let { subject = 'Appointment Schedule Invitation', text, html, event = 'Appointment Invitation', start, end, timezone, summary = "Meeting Invitation", description = "You are invited to a meeting.", location = "Online", url = generateMeetingUrl("Invitation") } = meetingDetails
        if (!start || !end) return res.status(400).json({ error: 'Start and end time are required.' });
        let { host, port, secure, user, pass, name, bcc, cc, service, clientId, clientSecret, refreshToken } = organizerDetails
        if (!host || !port || !user || !pass) return res.status(400).json({ error: 'SMTP details are missing or invalid' });
        const calendar = ical({ name: event });
        calendar.method(ICalCalendarMethod.REQUEST);
        calendar.createEvent({ start: new Date(start), end: new Date(end), timezone: timezone || DateTime.fromISO(new Date(start), { setZone: true }).zoneName, organizer: { name, email: user }, summary, description, location, url, attendees: attendees.map(email => ({ email, name: email.split('@')[0], rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' })) });
        const EmailResp = await sendEmail({ config: { host, port, secure, auth: { user, pass } }, emailData: { from: `${name} <${user}>`, to: attendees.join(" "), cc, bcc, subject, text, html, attachments: [{ filename: 'invite.ics', content: calendar.toString(), contentType: 'text/calendar' }] } })
        res.status(200).json({ success: true, message: 'Appointment Scheduled Successfully', data: EmailResp });
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
// const sendInviteRequest = async () => {
//     try {


//         // variables coming from agent are 

//         // well-defined 


//         const response = await fetch('https://chatapi.campusroot.com/send-invite', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json', },
//             body: JSON.stringify({
//                 meetingDetails: {
//                     subject: 'Team Sync',
//                     text: 'Please join the team sync meeting.',
//                     html: '<strong>Please join the team sync meeting.</strong>',
//                     event: 'Team Sync',
//                     start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
//                     end: new Date(Date.now() + 7200000).toISOString(),   // 2 hours from now
//                     summary: 'Weekly Team Sync',
//                     description: 'Agenda: Project updates and blockers.',
//                     location: 'Online',
//                     timezone: 'Asia/Kolkata',
//                 },
//                 attendees: ['john.doe@example.com', 'jane.doe@example.com'],
//                 organizerDetails: {
//                     host: 'smtp.example.com',
//                     port: 587,
//                     secure: false,
//                     user: 'organizer@example.com',
//                     pass: 'your_email_password',
//                     name: 'Organizer Name',
//                     cc: 'manager@example.com',
//                     bcc: 'admin@example.com',
//                 },
//             }),
//         });

//         const result = await response.json();

//         if (!response.ok) {
//             console.error('Invite failed:', result.error);
//         } else {
//             console.log('Invite sent successfully:', result.data);
//         }
//     } catch (err) {
//         console.error('Network error:', err.message);
//     }
// };
app.post("/raise-ticket", openCors, async (req, res) => {
    try {
        // business: { type: Types.ObjectId, ref: 'Businesses' },
        // issueSummary: { type: String, required: true },
        // channel: { type: String, enum: ['telegram', 'whatsapp', 'web', 'phone', 'instagram', 'sms', 'email'], required: true, },
        // priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', },
        // status: { type: String, enum: ['pending', 'responded', 'resolved'], default: 'pending' },
        // contactDetails: {
        //     email: { type: String },
        //     phone: { type: String },
        //     telegramId: { type: String },
        //     whatsappId: { type: String },
        //     instagramId: { type: String },
        // }
        await Ticket.create(req.body);
        return res.status(201).json({ message: "ticket raised successfully" });
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
})
app.use("/*", (req, res) => res.status(404).send("Route does not exist"))
app.use(errorHandlerMiddleware);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
process.on('SIGINT', async () => {
    console.log('\nGracefully shutting down...');

    try {
        server.close();

        // Example: close Redis
        // if (globalThis.redis) await globalThis.redis.quit();

        // // Example: close MongoDB
        // if (globalThis.mongo) await globalThis.mongo.disconnect();

        console.log('Shutdown complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});


// await sendMail({
//     to: attendees.join(','),
//     subject: ,
//     text: `You are invited to a meeting. Summary: ${summary}`,
//     html: `<div style="font-family: Arial, sans-serif; color: #333;">
//                   <h2>You are invited to a meeting</h2>
//                   <p><strong>Summary:</strong> ${summary}</p>
//                   <p><strong>Description:</strong> ${description}</p>
//                   <p><strong>Location:</strong> ${location}</p>
//                   <p><strong>Time:</strong> ${new Date(startTime).toUTCString()} - ${new Date(endTime).toUTCString()} (${timezone})</p>
//                   <p><a href="${url}" style="color: blue;">Join Meeting</a></p>
//                </div>`,
// })


