import { MongoClient } from "mongodb"
import OpenAI from "openai";
import { Data } from "../models/Data.js";
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
        3. Extract all necessary parameters for each intent.
        4. If a user provides partial information, infer missing details where possible.
        5. If a query implies an intent without stating it explicitly, deduce the intent logically.
        6. If multiple intents exist in a single query, extract them all.
        7. Avoid unnecessary defaults; only return 'request_info' if the user's message aligns with it.`,
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
                                    intentData: { type: "object", description: "Extracted parameters for the intent." },
                                },
                                required: ["intent", "intentData"],
                            },
                        },
                    },
                    required: ["actions"],
                },
            },
        },
    ];
    const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",  // Use gpt-4-turbo for better reasoning
        messages: [systemMessage, ...messages],
        tools,
        tool_choice: "auto",
    });
    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (toolCall) {
        const toolData = JSON.parse(toolCall.function.arguments);

        if (!toolData.actions || !Array.isArray(toolData.actions)) {
            console.error("Tool response does not contain valid actions array.");
            return null;
        }

        // Map extracted intents to the available actions
        const matchedActions = toolData.actions
            .map((action) => {
                const matched = availableActions.find((a) => a.intent === action.intent);
                return matched
                    ? { ...matched, intentData: { ...matched.intentData, ...action.intentData } }
                    : null;
            })
            .filter(Boolean);
        console.log("Executing Actions:", matchedActions);
        return matchedActions;
    }
    console.log("No valid tool execution.");
    return null;
}