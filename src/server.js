import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { initialize } from "./utils/dbConnect.js";
import errorHandlerMiddleware from './middleware/errorHandler.js';
import { registerApollo } from './graphql/index.js';
import { initializeSocket } from './utils/io.js';
import { indexRouter } from "./routers/index.js";
import { webhookRouter } from "./webhooks/index.js";
import sanitize from 'mongo-sanitize';
// weighted imports
import { emailConformation } from "./controllers/auth/register.js";
import { getContextMain } from "./utils/openai.js";
import { AgentModel } from "./models/Agent.js";
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
import ical, { ICalCalendarMethod } from 'ical-generator';
import { sendEmail, sendMail } from "./utils/sendEmail.js";
import { createToolWrapper, generateMeetingUrl, knowledgeToolBaker } from "./utils/tools.js";
import { DateTime } from "luxon";
import { Lead } from "./models/Lead.js";
import { Agent, run, RunState, tool } from '@openai/agents';
import { StreamEventHandler } from "./utils/streamHandler.js";
import { Ticket } from "./models/Tickets.js";
import "dotenv/config"
const whitelist = ["https://www.avakado.ai", "http://localhost:5174"];
export const corsOptions = {
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
export const openCors = cors({
    origin: true, // Reflect request origin
    credentials: true,
});
export const createApp = async () => {
    try {


        await initialize();
        const app = express();
        const server = http.createServer(app);
        // Middleware
        app.set('trust proxy', 1);
        app.options('/{*splat}', openCors)
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
        app.use(cookieParser());
        app.use(morgan(':date[web] :method :url :status - :response-time ms'));
        app.use(bodyParser.urlencoded({ extended: true }));
        app.use(express.json({ type: ["application/json", "text/plain"], limit: '50mb' }));
        app.use(express.urlencoded({ limit: '50mb', extended: true }));
        app.use((req, res, next) => {
            req.body = sanitize(req.body);
            req.params = sanitize(req.params);
            if (JSON.stringify(req.query) !== JSON.stringify(sanitize(req.query))) return res.status(400).json({ error: 'Invalid query parameters detected', message: 'Query contains potentially malicious content' });
            next();
        });
        // Routes
        app.get('/', (_, res) => res.status(200).send('Server running'));
        // weighted routes
        app.get("/email/confirmation", cors(corsOptions), emailConformation);
        app.post('/v1/agent', openCors, async (req, res) => {
            const handler = new StreamEventHandler();
            const totals = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

            try {
                const { userMessage, agentId, conversationId, geoLocation = {}, messageId, interruptionDecisions = [] } = req.body;
                // ✅ Fetch agent, conversation, and message in parallel
                let [agentDetails, conversation, message] = await Promise.all([
                    AgentModel.findById(agentId).populate("actions business"),
                    conversationId ? Conversation.findById(conversationId) : null,
                    messageId ? Message.findById(messageId) : null
                ]);

                if (!agentDetails) return res.status(404).json({ error: 'Agent not found' });

                // ✅ Setup response streaming
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Transfer-Encoding', 'chunked');
                res.flushHeaders();
                const write = chunk => { if (!res.writableEnded) res.write(JSON.stringify(chunk)); };
                // ✅ Prepare tools
                const toolsJson = agentDetails.actions?.map(ele => tool(createToolWrapper(ele))) || [];
                if (agentDetails.collections.length > 0) toolsJson.push(tool(knowledgeToolBaker(agentDetails.collections)));
                // ✅ Create agent
                const agent = new Agent({ name: agentDetails.personalInfo.name, instructions: agentDetails.personalInfo.systemPrompt, model: agentDetails.personalInfo.model, toolChoice: 'auto', temperature: agentDetails.personalInfo.temperature, tools: toolsJson, });
                // ✅ Initialize conversation if not exists
                if (!conversation) conversation = await Conversation.create({ business: agentDetails.business._id, agent: agentId, geoLocation: geoLocation.data, channel: "web" });
                // ✅ Create message if not exists
                if (!message) message = await Message.create({ business: agentDetails.business._id, query: userMessage, response: "", conversationId: conversation._id });
                // ✅ State preparation logic
                let state;
                if (interruptionDecisions.length > 0 && conversation.state) {
                    try {
                        // Restore previous state if available
                        state = await RunState.fromString(agent, conversation.state);
                    } catch (err) {
                        console.warn("Invalid conversation state, fallback to prevMessages:", err.message);
                    }

                    // Apply interruption decisions (approve/reject)
                    if (state) {
                        for (const decision of interruptionDecisions) {
                            const interruption = conversation.pendingInterruptions.find(ele => ele.rawItem.id == decision.id);
                            if (interruption) {
                                decision.action === 'approve' ? state.approve(interruption) : state.reject(interruption);
                            }
                        }
                    }

                    // Clear old interruptions and state in DB
                    await Conversation.findByIdAndUpdate(conversationId, { $set: { pendingInterruptions: [], state: "" } });
                }

                if (!state) {
                    // ✅ Build context from last 8 messages (user + assistant)
                    const messages = await Message.find({ conversationId: conversation._id })
                        .sort({ createdAt: -1 })
                        .limit(8)
                        .select("query response");

                    const contextMessages = messages.reverse().flatMap(({ query, response }) => {
                        const entries = [];
                        if (query) entries.push({ role: "user", content: [{ type: "input_text", text: query }] });
                        if (response) entries.push({ role: "assistant", content: [{ type: "output_text", text: response }] });
                        return entries;
                    });

                    // ✅ Add current user input
                    contextMessages.push({ role: "user", content: [{ type: "input_text", text: userMessage }] });
                    state = contextMessages;
                }

                // ✅ Start agent run with streaming
                let hasInterruptions = false;
                let collectedText = "";
                const stream = await run(agent, state, { stream: true, context: `Current time: ${new Date().toISOString()}\n Channel: Web \n` });
                try {
                    for await (const delta of stream) {
                        // ✅ Track token usage
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

                        // ✅ Process streaming event
                        const processed = handler.handleEvent(delta);
                        if (!processed) continue;

                        // ✅ Break when done
                        if (processed.type === "stream_complete" || delta.done === true) break;

                        const payload = {
                            id: "",
                            messageId: message._id,
                            conversationId: conversation._id,
                            responseType: "full",
                            data: null
                        };

                        switch (processed.type) {
                            case 'text_delta':
                                payload.id = "conversation";
                                payload.data = processed.delta;
                                payload.responseType = "chunk";
                                write(payload);
                                collectedText += processed.delta;
                                break;

                            case 'response_done':
                                message.response = collectedText.trim() || "Interrupted";
                                message.responseTokens = {
                                    model: processed.response.model,
                                    usage: totals
                                };
                                break;

                            case 'error':
                                payload.id = "error";
                                payload.data = processed.error;
                                write(payload);
                                break;
                        }
                    }

                    // ✅ Handle interruptions (partial response + approval required)
                    if (stream.interruptions?.length) {
                        hasInterruptions = true;
                        const newState = sanitizeState(stream.state);

                        const interruptionData = stream.interruptions.map(interruption => ({
                            ...interruption,
                            timestamp: new Date(),
                            status: 'pending'
                        }));

                        await Conversation.findByIdAndUpdate(conversation._id, {
                            $set: {
                                pendingInterruptions: interruptionData,
                                state: JSON.stringify(newState)
                            }
                        });

                        const interruptionPayload = {
                            id: "interruptions_pending",
                            conversationId: conversation._id,
                            messageId: message._id,
                            responseType: "interruption",
                            data: {
                                responseSoFar: collectedText.trim(),
                                interruptions: interruptionData.map(({ rawItem, type, message }) => ({
                                    rawItem: {
                                        ...rawItem,
                                        parameters: agentDetails.actions.find(ele => ele.intent === rawItem.name)
                                    },
                                    type,
                                    message
                                }))
                            }
                        };
                        write(interruptionPayload);
                    }

                } finally {
                    // ✅ Save message with final response or partial
                    await message.save();

                    // ✅ End response safely

                    !hasInterruptions ? write({ id: "end" }) : write({ id: "awaiting_approval", conversationId, messageId: message._id, message: "Waiting for user approval of pending actions" });

                    if (!res.writableEnded) res.end();
                }

            } catch (error) {
                console.error('Agent error:', error);
                if (!res.writableEnded) {
                    res.write(JSON.stringify({ id: "error", responseType: "full", data: error.message }));
                    res.end(JSON.stringify({ id: "end" }));
                }
            }
        });
        function sanitizeState(state) {
            try {
                const safe = { ...state };
                if (Array.isArray(safe.originalInput)) {
                    safe.originalInput = safe.originalInput.filter(msg =>
                        (msg.role === 'user' || msg.role === 'system') &&
                        msg.content.every(c => ['input_text', 'input_image', 'input_file', 'audio'].includes(c.type))
                    );
                }
                return safe;
            } catch {
                return {};
            }
        }
        app.post('/fetch-from-db', openCors, async (req, res) => {
            try {
                const { query, collections } = req.body;
                if (!query.trim()) return res.json({ success: false, message: 'empty query', data: null });
                if (collections.length < 1) return res.json({ success: false, message: 'empty collection', data: null });
                const { answer } = await getContextMain(collections, query);
                return res.json({ success: true, message: 'summary of what is in the knowledge base', data: answer });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ success: false, error: error.message, message: 'Internal server error' });
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
                const { meetingDetails = {}, attendees = [], organizerDetails = {}, sender = "AVA" } = req.body;
                // attendees must be an array of senders
                if (!Array.isArray(attendees) || attendees.length === 0) return res.status(400).json({ error: 'Attendees must be a non-empty array' });
                let { subject = 'Appointment Schedule Invitation', text, html, event = 'Appointment Invitation', start, end, timezone, summary = "Meeting Invitation", description = "You are invited to a meeting.", location = "Online", url = generateMeetingUrl("Invitation") } = meetingDetails
                if (!start || !end) return res.status(400).json({ error: 'Start and end time are required.' });
                const calendar = ical({ name: event });
                calendar.method(ICalCalendarMethod.REQUEST);
                if (sender === "AVA") {
                    calendar.createEvent({ start: new Date(start), end: new Date(end), timezone: timezone || DateTime.fromISO(new Date(start), { setZone: true }).zoneName, organizer: { name: "AVA", email: process.env.EMAIL_SMTP_AUTH }, summary, description, location, url, attendees: attendees.map(email => ({ email, name: email.split('@')[0], rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' })) });
                    sendMail({ to: attendees.join(" "), subject, text, html, attachments: [{ filename: 'invite.ics', content: calendar.toString(), contentType: 'text/calendar' }] });
                    return res.json({ success: true, message: 'Appointment Scheduled Successfully you will get email shorty to your inbox' });
                }
                let { host, port, secure, user, pass, name, bcc, cc, service, clientId, clientSecret, refreshToken } = organizerDetails
                if (!host || !port || !user || !pass) return res.status(400).json({ error: 'SMTP details are missing or invalid' });
                calendar.createEvent({ start: new Date(start), end: new Date(end), timezone: timezone || DateTime.fromISO(new Date(start), { setZone: true }).zoneName, organizer: { name, email: user }, summary, description, location, url, attendees: attendees.map(email => ({ email, name: email.split('@')[0], rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' })) });
                sendEmail({ config: { host, port, secure, auth: { user, pass } }, emailData: { from: `${name} <${user}>`, to: attendees.join(" "), cc, bcc, subject, text, html, attachments: [{ filename: 'invite.ics', content: calendar.toString(), contentType: 'text/calendar' }] } })
                res.status(200).json({ success: true, message: 'Appointment Scheduled Successfully you will get email shorty to your inbox' });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ error: error.message })
            }
        });
        app.post('/send-mail', openCors, async (req, res) => {
            try {
                const { to, subject, text, html, attachments = [] } = req.body;
                if (!to || !subject || !text) return res.status(400).json({ error: 'To, subject and text are required' });
                const emailResp = await sendMail({ to, subject, text, html, attachments });
                return res.json({ success: true, message: 'Email sent successfully', data: emailResp });
            } catch (error) {
                console.error(error);
                return res.status(500).json({ success: false, error: error.message, message: 'Internal server error' });
            }
        });
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
        app.post("/raise-ticket", openCors, async (req, res) => {
            try {
                const { business, issueSummary, channel, priority, contactDetails, notifierEmail } = req.body;
                await Ticket.create({ business, issueSummary, channel, priority, contactDetails, notifierEmail });
                return res.status(201).json({ message: "ticket raised successfully" });
            } catch (err) {
                console.error(err);
                res.status(400).json({ error: err.message });
            }
        })


        app.use("/api/v1", cors(corsOptions), indexRouter);
        app.use("/webhook", webhookRouter);
        // Apollo setup
        await registerApollo(app, server);
        // Sockets
        await initializeSocket(server)
        // Error handling
        app.use(errorHandlerMiddleware);
        app.use("/{*splat}", (_, res) => res.status(404).send("Route does not exist"))

        return { app, server };
    } catch (error) {

        console.error("failed to start server", error);
    }
};
