import OpenAI from "openai";
import { Data } from "../models/Data.js";
import { tokenSize } from "./tiktoken.js";
import mongoose from "mongoose";
export const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
export const EmbeddingFunct = async (text) => {
    try {
        const { data, model, usage } = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        return { data, model, usage }
    } catch (error) {
        console.error(error);
        return null;
    }
}
export const getSummary = async (chunk) => {
    try {
        const { choices } = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "Convert the following content into organized bullet points. Extract: • Main topics • Key facts • All URLs/links • Important terms, dates, and figures. Keep information accurate and concise."
                },
                { role: "user", content: chunk }
            ]
        });
        return choices[0].message.content
    } catch (error) {
        console.error(error);
        return null;
    }
}
export const actions = async (messages, availableActions) => {
    const systemMessage = {
        role: "system",
        content: `You are an AI assistant designed to analyze all previous messages to maintain context, classify user intents, and extract structured data for predefined actions.
        Your goal is to accurately identify one or more relevant intents and extract structured parameters.
        Today:${new Date()}
        Your task is to:
        1️⃣ Identify one or more relevant intents ONLY from the available actions:
           ${JSON.stringify(availableActions, null, 2)}
        2️⃣ Extract required parameters for each identified intent from conversation based on the provided data schema in tool calls.
        3️⃣ Assign a confidence score (between 0 and 1) to each detected intent based on certainty.
        4️⃣ If multiple intents exist, extract them all with confidence.
        5️⃣ Infer missing parameters from conversation context when possible.
        6️⃣ If a parameter cannot be inferred, set its value to null.
        7️⃣ If a query implies an intent without stating it explicitly, deduce the intent logically.
        🚨 ALWAYS provide at least one intent with a confidence score, even if the intent is uncertain.
        🚨 ALWAYS use the exact same output format with actions array containing intent, confidence, and dataSchema.
        🚨 ALWAYS return ALL relevant intents - do not limit to just one intent when multiple are applicable.`
    };
    const tools = [
        {
            type: "function",
            function: {
                name: "universal_tool",
                description: "Handles one or more intent-based actions dynamically.",
                strict: true,
                parameters: {
                    type: "object",
                    properties: {
                        actions: {
                            type: "array",
                            description: "A list of identified actions matching the user query.",
                            items: {
                                type: "object",
                                properties: {
                                    intent: { type: "string", description: "The identified user intent." },
                                    confidence: {
                                        type: "number",
                                        description: "Confidence score (0 to 1) indicating certainty of intent classification."
                                    },
                                    dataSchema: {
                                        type: "array",
                                        description: "Extracted parameters for the intent, stored under 'data', based on given json of actions.",
                                        items: {
                                            type: "object",
                                            properties: {
                                                key: { type: "string", description: "Parameter name." },
                                                data: {
                                                    type: ["string", "number", "boolean", "null"],
                                                    description: "Extracted value or null if missing. maintain same structure"
                                                }
                                            },
                                            required: ["key", "data"],
                                            additionalProperties: false
                                        }
                                    }
                                },
                                required: ["intent", "confidence", "dataSchema"],
                                additionalProperties: false
                            },
                        },
                    },
                    required: ["actions"],
                    additionalProperties: false
                },
            },
        },
    ];
    const modelOptions = {
        model: "gpt-4o-mini-2024-07-18",
        temperature: 0.7, // Slightly higher temperature to encourage multiple intents when appropriate
        messages: [systemMessage, ...messages],
        tools,
        tool_choice: "required",
    };
    try {
        const { model, usage, choices } = await openai.chat.completions.create(modelOptions);
        const toolCall = choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
            console.warn("No valid tool execution.");
            return { matchedActions: [], model, usage };
        }
        let toolData;
        try {
            toolData = JSON.parse(toolCall.function.arguments);
            // Ensure we have the consistent structure with actions array
            if (!toolData.actions || !Array.isArray(toolData.actions)) {
                // Transform inconsistent format into proper format
                const transformedActions = [];
                // If we got a flattened object like {Topic: "something"} instead of proper structure
                if (typeof toolData === 'object' && !Array.isArray(toolData)) {
                    const dataSchema = Object.entries(toolData).map(([key, data]) => ({ key, data }));
                    transformedActions.push({ intent: "enquiry", confidence: 0.7, dataSchema });
                } else if (Array.isArray(toolData)) toolData = { actions: toolData };
                if (transformedActions.length > 0) toolData = { actions: transformedActions };
            }
            // Validate each action has required fields
            toolData.actions = toolData.actions.map(action => { return { intent: action.intent || "enquiry", confidence: typeof action.confidence === 'number' ? action.confidence : 0.7, dataSchema: Array.isArray(action.dataSchema) ? action.dataSchema : [{ "key": "Topic", "data": messages.at(-1) }] }; });
        } catch (error) {
            console.warn("Error parsing tool call arguments:", error);
            toolData = { actions: [] };
        }
        return { matchedActions: toolData.actions, model, usage };
    } catch (error) {
        console.error("Error processing actions:", error);
        return { matchedActions: [], model: null, usage: null };
    }
};
export const getContextMain = async (collectionIds, text, options = {}) => {
    const { numCandidates = 500, limit = 5 } = options;
    const embeddingResult = await EmbeddingFunct(text)
    try {
        // First stage retrieval with more candidates
        let context = await Data.aggregate([
            {
                $vectorSearch: {
                    "exact": false,
                    "filter": { "collection": { $in: collectionIds.map(ele => new mongoose.Types.ObjectId(ele)) } },
                    "index": "vector_index",
                    "path": "embeddingVector",
                    "queryVector": embeddingResult.data[0].embedding,
                    "numCandidates": numCandidates,
                    "limit": limit, // Retrieve more documents initially for reranking
                }
            },
            {
                $project: {
                    metadata: 1,
                    summary: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ]);
        let result = {
            context: [],
            answer: '',
            embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            },
        };
        context.forEach(ele => {
            result.answer += `\n${ele.summary}\n`;
            result.context.push({ ...ele.metadata, score: ele.score, chunkNumber: ele.chunkNumber });
        })
        return result;
    } catch (error) {
        console.error(error);
        return {
            context: [],
            answer: '',
            embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            },
        };;
    }
}
export const AssistantResponse = async (req, res, config) => {
    const { prevMessages, additional_instructions, assistant_id, messageId, conversationId, signalKeyword = "DATAPOINT_NEXUS", streamOption } = config;
    const thread = await openai.beta.threads.create({ messages: prevMessages });
    if (streamOption) { res.setHeader('Content-Type', 'text/plain'); res.setHeader('Transfer-Encoding', 'chunked'); }
    const stream = await openai.beta.threads.runs.create(thread.id, { assistant_id, additional_instructions, stream: true });
    let signalDetected = false, responseTokens, response = ""
    for await (const chunk of stream) {
        switch (chunk.event) {
            case "thread.message.delta":
                const content = chunk.data.delta.content[0]?.text?.value || "";
                if (content) {
                    if (content.includes(signalKeyword)) signalDetected = true;
                    const cleanContent = content.replace(signalKeyword, "") || content;
                    response += cleanContent;
                    if (streamOption) res.write(JSON.stringify({ id: "conversation", messageId, conversationId, responseType: "chunk", data: cleanContent }));
                }
                break;
            case "thread.run.completed":
                try {
                    await openai.beta.threads.del(thread.id);
                    console.log(`Thread deleted`);
                } catch (error) {
                    console.error(`Error deleting thread: ${error.message}`);
                    // Continue with execution, ignoring the thread deletion error
                }
                const { usage, model } = chunk.data
                responseTokens = { usage, model };
                console.log(`Thread deleted`);
                break;
        }
    }
    if (response.includes(signalKeyword)) {
        signalDetected = true;
        response = response.replace(signalKeyword, "");
    }
    return { responseTokens, response, signalDetected }
}
export const generateAIResponse = async (userMessageText, contactName) => {
    try {
        const systemPrompt = contactName
            ? `You are a helpful assistant responding to ${contactName} on WhatsApp. Be concise, friendly, and address them by name occasionally.`
            : "You are a helpful assistant responding to messages from WhatsApp users. Be concise, friendly, and helpful.";
        // Generate AI response using GPT-4 Omini with personalized prompt
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessageText }
            ],
            max_tokens: 500,
        });

        return aiResponse.choices[0].message.content.trim();
    } catch (error) {
        console.error("❌ Error generating AI response:", error);
        return "I'm sorry, I couldn't process your request at the moment. Please try again later.";
    }
};
