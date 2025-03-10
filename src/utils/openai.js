import { MongoClient } from "mongodb"
import OpenAI from "openai";
import { Data } from "../models/Data.js";
import { writeFileSync } from "fs";
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
        // let { choices } = await openai.chat.completions.create({
        //     model: "gpt-4o-mini",
        //     messages: [
        //         { role: "system", content: "Summarize the given text concisely while preserving key points." },
        //         { role: "user", content: chunk }
        //     ]
        // })
        // return choices[0].message.content
        return ""
    } catch (error) {
        console.error(error);
        return null;
    }
}
export const getContext = async (institutionName, text) => {
    const dbName = 'Demonstrations';
    const [client, embeddingResult] = await Promise.all([MongoClient.connect(process.env.GEN_MONGO_URL), EmbeddingFunct(text)])
    const db = client.db(dbName);
    try {
        let context = await db.collection('Data').aggregate([
            {
                "$vectorSearch": {
                    "exact": false,
                    "filter": { "metadata.institutionName": institutionName },
                    "index": "Data",
                    "path": "embeddingVector",
                    "queryVector": embeddingResult.data[0].embedding,
                    "numCandidates": 100,
                    "limit": 3
                }
            },
            {
                $project: {
                    content: 1,
                    chunk_number: 1,
                    metadata: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ]).toArray()
        await client.close();
        const result = {
            context: [], data: "", embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            }
        }
        context.forEach((ele) => {
            result.data += '\n' + ele.content + '\n'
            result.context.push({ chunk_number: ele.chunk_number, ...ele.metadata, score: ele.score })
        })
        return result;
    } catch (error) {
        await client.close();
        console.error(error);
        return null;
    }
}
export const getContextMain = async (collectionIds, text) => {
    const embeddingResult = await EmbeddingFunct(text)
    try {
        let context = await Data.aggregate([
            {
                $vectorSearch: {
                    "exact": false,
                    "filter": { "collection": { $in: collectionIds } },      // collectionIds will be like [ new ObjectId('67bcb48ed9a4b270b14fa171') ]
                    "index": "Data",
                    "path": "embeddingVector",
                    "queryVector": embeddingResult.data[0].embedding,
                    "numCandidates": 500,
                    "limit": 5
                }
            },
            {
                $project: {
                    content: 1,
                    chunk_number: 1,
                    metadata: 1,
                    summary: 1,
                    score: { $meta: 'vectorSearchScore' }
                }
            }
        ])
        let result = {
            context: [], data: "", embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            }
        }
        context.forEach((ele) => {
            result.data += '\n' + ele.content + '\n'
            result.context.push({ chunk_number: ele.chunk_number, ...ele.metadata, score: ele.score })
        })
        return result;
    } catch (error) {
        console.error(error);
        return null;
    }
}
export const actions = async (messages, availableActions) => {
    const systemMessage = {
        role: "system",
        content: `You are an AI assistant designed to dynamically match user queries to predefined actions.
        Your goal is to accurately identify one or more relevant intents and extract structured parameters.
        Follow these rules:
        1. Analyze all previous messages to maintain context.
        2. Identify one or more relevant intents ONLY from the available actions:
           ${JSON.stringify(availableActions, null, 2)}
        3. Extract all necessary parameters for each identified intent.
        4. If some required parameters are missing, attempt to infer them based on context.
        5. If a query implies an intent without stating it explicitly, deduce the intent logically.
        6. If multiple intents exist in a single query, extract them all.
        7. Only use "request_info" if the user's message explicitly asks for general information.`,
    };
    const tools = [
        {
            type: "function",
            function: {
                name: "universal_tool",
                description: "Handles one or more intent-based actions dynamically.",
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
                                    dataSchema: {
                                        type: "array",
                                        description: "Extracted parameters for the intent, stored under 'data'.",
                                        items: {
                                            type: "object",
                                            properties: {
                                                label: { type: "string", description: "Parameter name." },
                                                data: {
                                                    type: ["string", "number", "boolean", "null"],
                                                    description: "Extracted value or null if missing."
                                                }
                                            },
                                            required: ["label", "data"]
                                        }
                                    }
                                },
                                required: ["intent", "dataSchema"],
                            },
                        },
                    },
                    required: ["actions"],
                },
            },
        },
    ];
    try {
        const { model, usage, choices } = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [systemMessage, ...messages],
            tools,
            tool_choice: "auto",
            // response_format: { "type": "json_object" }  
        });

        const toolCall = choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
            console.warn("No valid tool execution.");
            return { matchedActions: [], model, usage };
        }

        const toolData = JSON.parse(toolCall.function.arguments);
        if (!Array.isArray(toolData.actions)) {
            console.error("Tool response does not contain valid actions array.");
            return { matchedActions: [], model, usage };
        }

        // Map extracted intents to available actions
        const matchedActions = toolData.actions
            .map(({ intent, dataSchema }) => {
                const matched = availableActions.find((a) => a.intent === intent);
                return matched ? { ...matched, dataSchema: dataSchema ?? [] } : null;
            })
            .filter(Boolean);
        return { matchedActions, model, usage };
    } catch (error) {
        console.error("Error processing actions:", error);
        return { matchedActions: [], model: null, usage: null };
    }
};