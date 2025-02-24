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
import { getContext, getContextMain, openai } from "./utils/openai.js";
import { MongoClient, ObjectId } from "mongodb";
import { Agent } from "./models/Agent.js";
import { Business } from "./models/Business.js";
import { Conversation } from "./models/Conversations.js";
import { Message } from "./models/Messages.js";
await initialize();
const app = express();
const whitelist = ["https://ava.campusroot.com", "http://localhost:5174"];
const corsOptions = {
    origin: (origin, callback) => (!origin || whitelist.indexOf(origin) !== -1) ? callback(null, true) : callback(new Error(`Origin ${origin} is not allowed by CORS`)),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],  // Add necessary headers
    credentials: true,
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
app.get("/client/:clientId", async (req, res) => {
    try {
        const client = await MongoClient.connect(process.env.GEN_MONGO_URL);
        let clientDetails = await client.db("Demonstrations").collection("Admin").findOne({ _id: new ObjectId(req.params.clientId) }, { projection: { businessName: 1, dp: 1, themeId: 1, facts: 1, questions: 1 } });
        if (!clientDetails) return res.status(404).json({ error: 'Client not found' });
        await client.close();
        res.status(200).json({ success: true, message: "Client info", data: clientDetails })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
})
app.post('/chat-bot', async (req, res) => {
    try {
        const { userMessage, prevMessages = [], clientId, streamOption = false } = req.body;
        const client = await MongoClient.connect(process.env.GEN_MONGO_URL);
        let { institutionName, businessName, systemPrompt, UserPrompt, tools } = await client.db("Demonstrations").collection("Admin").findOne({ _id: new ObjectId(clientId) });
        const message = { "query": userMessage, "response": "", "embeddingTokens": {}, "responseTokens": {}, clientId: new ObjectId(clientId) }
        const { context, data, embeddingTokens } = await getContext(institutionName, userMessage)
        message.embeddingTokens = embeddingTokens
        message.context = context
        if (data == "") console.log("Empty context received")
        if (!streamOption) {
            const { choices, model, usage } = await openai.chat.completions.create({
                // const { choices, model, usage } = await lamaClient.chat.completions.create({
                model: "gpt-4o-mini",
                // model: "llama3.2-3b",
                messages: [
                    { "role": "system", "content": systemPrompt },
                    ...prevMessages,
                    {
                        role: "user",
                        content: UserPrompt.replace("${contexts}", data).replace("${userMessage}", userMessage).replace("${businessName}", businessName)
                    }],
                tools: tools.length > 1 ? tools : null,
                store: tools.length > 1 ? true : null,
                tool_choice: tools.length > 1 ? "auto" : null,
            })
            message.responseTokens = { model, usage }
            message.response = choices[0].message.content
            await client.db("Demonstrations").collection("Analysis").insertOne(message);
            await client.close();
            return res.status(200).send({ success: true, data: choices[0].message.content })  // if tools are used then it works differently
        }
        const stream = await openai.chat.completions.create({
            // const stream = await lamaClient.chat.completions.create({
            // model: "llama3.2-3b",
            model: "gpt-4o-mini",
            messages: [
                { "role": "system", "content": systemPrompt, },
                ...prevMessages,
                {
                    role: "user",
                    content: UserPrompt.replace("${contexts}", data).replace("${userMessage}", userMessage)
                }],
            stream: true,
            tools: tools.length > 1 ? tools : null,
            store: tools.length > 1 ? true : null,
            tool_choice: tools.length > 1 ? "auto" : null,
        });
        let finalToolCalls = [];
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        for await (const chunk of stream) {
            const { choices } = chunk
            if (chunk.choices[0].finish_reason === "stop") {
                const { model, usage } = chunk
                message.responseTokens = { model, usage }
            }
            const toolCalls = choices[0].delta.tool_calls || [];
            for (const toolCall of toolCalls) {
                const { index } = toolCall;
                if (!finalToolCalls[index]) finalToolCalls[index] = toolCall;
                finalToolCalls[index].function.arguments += toolCall.function.arguments;
            }
            if (choices[0]?.delta?.content !== null && choices[0]?.delta?.content !== undefined) {
                message.response += choices[0]?.delta?.content
                res.write(JSON.stringify({ chunk: choices[0]?.delta?.content, toolResponse: [] }));
            }
        }
        const functionCalls = []
        finalToolCalls.forEach(ele => {
            let parameters = JSON.parse(ele.function.arguments); // Parse the arguments string
            let functionName = ele.function.name; // Get the function name
            const result = toolFunctions[functionName](parameters)
            functionCalls.push(result)
        });
        await client.db("Demonstrations").collection("Analysis").insertOne(message);
        await client.close();
        res.end(JSON.stringify({
            chunk: "",
            toolResponse: functionCalls
        }))
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
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
        let prevMessages = [{ role: "system", content: agent.personalInfo.systemPrompt || "" }];
        if (conversation) {
            const messages = await Message.find({ conversationId }).select("query response");
            prevMessages.push(...messages.flatMap(({ query, response }) => [
                { role: "user", content: query },
                { role: "assistant", content: response }
            ]));
        } else {
            conversation = await Conversation.create({ business: business._id, agent: agentId });
        }
        const { context, data, embeddingTokens } = await getContextMain(agent.collections, userMessage);
        const userPrompt = `For this query, the system has retrieved the following relevant information from ${business.name}’s database:\n${data}\n\nUsing this institutional data, generate a clear, precise, and tailored response to the following user inquiry: \n${userMessage}\n\nIf the retrieved data does not fully cover the query, acknowledge the limitation while still providing the most relevant response possible.`;
        prevMessages.push({ role: "user", content: userPrompt });
        const message = {
            query: userMessage,
            response: "",
            embeddingTokens,
            responseTokens: {},
            conversationId: conversation._id,
            context
        };
        if (!streamOption) {
            const { choices, model, usage } = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: prevMessages });
            message.responseTokens = { model, usage };
            message.response = choices[0].message.content;
            let msg = await Message.create(message);
            return res.status(200).json({ success: true, data: message.response, conversationId: conversation._id, messageId: msg._id });
        }
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        const stream = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: prevMessages, stream: true });
        let msg = await Message.create(message);
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                message.response += content;
                res.write(JSON.stringify({ conversationId: conversation._id, chunk: content, messageId: msg._id }));
            }
            if (chunk.choices[0].finish_reason === "stop") {
                msg.responseTokens = { model: chunk.model, usage: chunk.usage };
            }
        }
        await msg.save()
        res.end(JSON.stringify({ conversationId: conversation._id, chunk: "", messageId: msg._id }))
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
app.put("/reaction", async (req, res) => {
    const { messageId, reaction } = req.body;

    // Validation for messageId and reaction
    if (!messageId || !reaction) {
        return res.status(400).json({ message: "Message ID and reaction are required" });
    }
    if (!["neutral", "like", "dislike"].includes(reaction)) {
        return res.status(400).json({ message: "Undefined reaction" });
    }

    try {
        // Assuming messageId is the _id of the document in the database
        const updatedMessage = await Message.findByIdAndUpdate(
            messageId, 
            { $set: { reaction: reaction } },
            { new: true }  // Option to return the updated document
        );

        if (!updatedMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        return res.status(200).json({ success: true, message: "message updated" });
    } catch (err) {
        return res.status(500).json({ message: "An error occurred", error: err.message });
    }
});

app.use("/*", (req, res) => res.status(404).send("Route does not exist"))
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));