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
import { actions, getEnhancedContext, openai } from "./utils/openai.js";
import { Agent } from "./models/Agent.js";
import { Business } from "./models/Business.js";
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
import { createServer } from "http";
import { initializeSocket, io } from "./utils/io.js";
import { Action } from "./models/Action.js";
await initialize();
const app = express();
const server = createServer(app); // Create HTTP server
await initializeSocket(server);
// const whitelist = ["https://ava.campusroot.com", "http://localhost:5174"];
// const corsOptions = {
//     origin: (origin, callback) => (!origin || whitelist.indexOf(origin) !== -1) ? callback(null, true) : callback(new Error(`Origin ${origin} is not allowed by CORS`)),
//     methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],  // Add necessary headers
//     credentials: true,
//     optionsSuccessStatus: 200
// };
const corsOptions = {
    origin: '*', // Allows all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true, // Be careful: This should not be used with '*'
    optionsSuccessStatus: 200
};
app.set('trust proxy', 1) // trust first proxy
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.json({ type: ["application/json", "text/plain"], limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(helmet.contentSecurityPolicy());
app.use(helmet.frameguard({ action: 'sameorigin' }));
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(helmet.permittedCrossDomainPolicies({ permittedPolicies: 'none' }));
app.use(ExpressMongoSanitize());
app.use(morgan(':date[web] :method :url :status :res[content-length] - :response-time ms'));
app.use(express.json());
app.use(cors());
app.get("/", (req, res) => res.send("Server up and running"));
app.get("/email/confirmation", emailConformation)
app.use("/api/v1", indexRouter)
app.post('/v2/chat-bot', async (req, res) => {
    try {
        const { userMessage, agentId, streamOption = false, conversationId } = req.body;
        let [agent, business, conversation] = await Promise.all([
            Agent.findById(agentId),
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
            let clientIP = getClientIP(req);
            let geoLocation = await getGeoLocation(clientIP);
            conversation = await Conversation.create({ business: business._id, agent: agentId, geoLocation });
        }
        const { source, context, answer, embeddingTokens } = await getEnhancedContext(agent.collections, userMessage, prevMessages, 3);
        if (["error", "insufficient"].includes(source)) {
            // no information available stop the conversation process and only see if actions work 
        }
        let systemPrompt = (agent.personalInfo.systemPrompt || "") + `\nContext: ${answer}\n Use this context to generate a clear, precise, and tailored response to the user. If the retrieved data does not fully cover the query, acknowledge the limitation while still providing the most relevant response possible. But don't specify about information retrieval explicitly and only provide the most relevant response with links`
        prevMessages.unshift({ role: "system", content: systemPrompt });
        prevMessages.push({ role: "user", content: userMessage });
        const message = {
            business: business._id,
            query: userMessage,
            response: "",
            embeddingTokens,
            responseTokens: {},
            conversationId: conversation._id,
            context,
            contextData: answer,
            Actions: [],
            actionTokens: {},
        };
        let Actions = [];
        if (agent.actions && agent.actions.length > 0) {
            agent.actions = await Action.find({ _id: { $in: agent.actions } });
            const { matchedActions, model, usage } = await actions(prevMessages.slice(1), agent.actions.map(action => ({ intent: action.intent, dataSchema: action.dataSchema })));
            message.actionTokens = { model, usage }
            message.Actions = matchedActions
            for (const ele of matchedActions) {
                const act = agent.actions.find(action => ele.intent === action.intent)
                Actions.push({ _id: act._id, intent: ele.intent, dataSchema: ele.dataSchema, UI: act.UI })
            }
        }
        if (!streamOption) {
            const { choices, model, usage } = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: prevMessages });
            message.responseTokens = { model, usage };
            message.response = choices[0].message.content;
            let msg = await Message.create(message);
            res.write(JSON.stringify({ id: "conversation", messageId: msg._id, conversationId: conversation._id, responseType: "full", data: message.response }));
            if (Actions.length > 0) res.write(JSON.stringify({ id: "data-collection", data: Actions, responseType: "full" }))
            return res.end(JSON.stringify({ id: "end" }))
        }
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        const stream = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: prevMessages, stream: true });
        let msg = await Message.create(message);
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                msg.response += content;
                res.write(JSON.stringify({ id: "conversation", messageId: msg._id, conversationId: conversation._id, responseType: "chunk", data: content }));
            }
            if (chunk.choices[0].finish_reason === "stop") {
                const completion_tokens = tokenSize(chunk.model, msg.response);
                const prompt_tokens = tokenSize(chunk.model, msg.query);
                msg.responseTokens = { model: chunk.model, usage: { completion_tokens, prompt_tokens, total_tokens: completion_tokens + prompt_tokens } };
            }
        }
        await msg.save()
        if (Actions.length > 0) res.write(JSON.stringify({ id: "data-collection", data: Actions, responseType: "full" }))
        return res.end(JSON.stringify({ id: "end" }))
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
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
import { tokenSize } from "./utils/tiktoken.js";
import { getClientIP, getGeoLocation } from "./utils/ipWorker.js";
app.post('/send-invite', async (req, res) => {
    try {
        const { attendees, summary, startTime, endTime, timezone, description, location, url } = req.body;
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) return res.status(400).json({ error: 'Attendees list is required' });
        if (!startTime || !endTime || !timezone) return res.status(400).json({ error: 'Start time, end time, and timezone are required' });
        const calendar = ical({ name: 'Appointment Invitation' });
        calendar.method(ICalCalendarMethod.REQUEST);
        calendar.createEvent({
            start: new Date(startTime),
            end: new Date(endTime),
            timezone: timezone,
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
