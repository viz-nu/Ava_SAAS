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
/**
 * Enhanced context retrieval function that intelligently fetches the best context
 * for answering queries using conversation history, vector search, and LLM analysis
 * 
 * @param {Array} collectionIds - Array of collection IDs to search in
 * @param {String} query - The user's current query
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Object} llmClient - Client for LLM interactions
 * @param {Number} maxRetries - Maximum number of vector search retries (default: 3)
 * @returns {Object} The context information and answer status
 */
const getEnhancedContext = async (collectionIds, query, conversationHistory, llmClient, maxRetries = 3) => {
    // Initialize result object with scalable structure
    const result = {
        source: null, // 'conversation', 'vectorSearch', 'combined', 'insufficient'
        answer: null,
        context: [],
        relevantConversation: [],
        vectorSearchAttempts: 0,
        embeddingTokens: null,
        confidence: 0, // 0-1 score of confidence in the answer
        requiresFollowUp: false
    };
    try {
        // Step 1: Analyze conversation history to see if answer exists there
        if (conversationHistory && conversationHistory.length > 0) {
            const conversationAnalysis = await analyzeConversationForAnswer(query, conversationHistory);
            if (conversationAnalysis.answerStatus == "complete") {
                result.source = 'conversation';
                result.answer = conversationAnalysis.answer;
                result.confidence = conversationAnalysis.confidence;
                return result;
            }
            else if (conversationAnalysis.answerStatus == "partial"){

            }
            else{

            }
            // Store relevant conversation parts for potential later use
            result.relevantConversation = conversationAnalysis.relevantMessages;
        }
        // Step 2: Perform vector search and progressive refinement
        let currentQuery = query;
        let partialContexts = [];
        let attempts = 0;
        while (attempts < maxRetries) {
            attempts++;
            result.vectorSearchAttempts = attempts;

            // Get vector search results
            const vectorResult = await performVectorSearch(collectionIds, currentQuery);

            if (!vectorResult) {
                break;
            }

            result.embeddingTokens = vectorResult.embeddingTokens;

            // Analyze if vector search results answer the query
            const searchAnalysis = await analyzeSearchResults(query, vectorResult.data, llmClient);

            if (searchAnalysis.completeAnswer) {
                // We have a complete answer from vector search
                result.source = 'vectorSearch';
                result.answer = searchAnalysis.answer;
                result.context = [...vectorResult.context];
                result.confidence = searchAnalysis.confidence;
                return result;
            } else if (searchAnalysis.partialAnswer) {
                // Store partial context for combined answer later
                partialContexts.push({
                    data: vectorResult.data,
                    context: vectorResult.context,
                    relevantParts: searchAnalysis.relevantParts
                });

                // Refine query for next attempt
                currentQuery = searchAnalysis.refinedQuery || currentQuery;
            } else {
                // No useful information found
                break;
            }
        }

        // Step 3: Combine partial contexts if we have any
        if (partialContexts.length > 0) {
            const combinedAnswer = await combinePartialContexts(query, partialContexts, result.relevantConversation, llmClient);

            result.source = 'combined';
            result.answer = combinedAnswer.answer;
            result.context = partialContexts.flatMap(pc => pc.context);
            result.confidence = combinedAnswer.confidence;
            result.requiresFollowUp = combinedAnswer.requiresFollowUp;

            return result;
        }

        // Step 4: If we reach here, we couldn't find a satisfactory answer
        result.source = 'insufficient';
        result.answer = generateInsufficientDataResponse(query);
        result.confidence = 0.1;
        result.requiresFollowUp = true;

        return result;

    } catch (error) {
        console.error("Error in getEnhancedContext:", error);
        return {
            source: 'error',
            error: error.message,
            context: [],
            relevantConversation: [],
            vectorSearchAttempts: result.vectorSearchAttempts
        };
    }
};

/**
 * Performs vector search using the embedding function
 * @param {Array} collectionIds - Collection IDs to search in
 * @param {String} text - Text to find embeddings for
 * @returns {Object} Search results and context
 */
const performVectorSearch = async (collectionIds, text) => {
    const embeddingResult = await EmbeddingFunct(text);
    try {
        let context = await Data.aggregate([
            {
                $vectorSearch: {
                    exact: false,
                    filter: { collection: { $in: collectionIds } },
                    index: "Data",
                    path: "embeddingVector",
                    queryVector: embeddingResult.data[0].embedding,
                    numCandidates: 500,
                    limit: 5
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
        ]);

        let result = {
            context: [],
            data: "",
            embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            }
        };

        context.forEach((ele) => {
            result.data += '\n' + ele.content + '\n';
            result.context.push({
                chunk_number: ele.chunk_number,
                ...ele.metadata,
                score: ele.score
            });
        });

        return result;
    } catch (error) {
        console.error("Error in performVectorSearch:", error);
        return null;
    }
};

/**
 * Analyzes conversation history to find if the answer exists
 * @param {String} query - Current user query
 * @param {Array} history - Conversation history
 * @param {Object} llmClient - LLM client for analysis
 * @returns {Object} Analysis results
 */
const analyzeConversationForAnswer = async (query, history) => {
    // Prepare conversation context for LLM
    const conversationContext = history.map(msg => `${msg.role}: ${msg.content}`).join("\n\n");
    // Prompt for LLM to analyze if the answer exists in conversation
    const messages = [
        {
            role: "system",
            content: "You are analyzing a conversation to determine if the answer to a question already exists, either completely or partially. Provide your analysis in JSON format."
        },
        {
            role: "user",
            content: `CONVERSATION: ${conversationContext}
                CURRENT QUERY: ${query}
                Determine if the answer to the CURRENT QUERY exists in the CONVERSATION, either completely or partially.
                Consider the following levels of answers:
                1. Complete answer: The conversation contains all information needed to fully answer the query.
                2. Partial answer: The conversation contains some relevant information but not a complete answer.
                3. No answer: The conversation doesn't contain information relevant to the query.
                Respond in the following JSON format:
                {
                  "answerStatus": "complete" | "partial" | "none",
                  "answer": "extracted or synthesized answer if complete/partial, null if none",
                  "missingElements": "description of what information is missing (for partial answers)",
                  "confidence": float from 0 to 1,
                  "shouldUseVectorSearch": boolean
                }`
        }
    ];
    try {
        const response = await openai.chat.completions.create({
            messages,
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
        });
        return response.choices?.[0]?.message?.content ? JSON.parse(response.choices[0].message.content) : { answerStatus: "none", answer: null, missingElements: "", confidence: 0, shouldUseVectorSearch: true };
    } catch (error) {
        console.error("LLM Conversation analysis error:", error);
        return { answerStatus: "none", answer: null, missingElements: "", confidence: 0, shouldUseVectorSearch: true };
    }

};

/**
 * Analyzes search results to determine if they answer the query
 * @param {String} query - User query
 * @param {String} searchData - Vector search results
 * @param {Object} llmClient - LLM client for analysis
 * @returns {Object} Analysis results
 */
const analyzeSearchResults = async (query, searchData, llmClient) => {
    const prompt = `
      You are analyzing vector search results to determine if they answer a query.
      
      QUERY: ${query}
      
      SEARCH RESULTS:
      ${searchData}
      
      Analyze if these search results fully answer the query, partially answer it, or don't answer it at all.
      Respond in the following JSON format:
      {
        "completeAnswer": boolean,
        "partialAnswer": boolean,
        "answer": "complete answer if found, null if not",
        "relevantParts": "extract of the most relevant parts from search results",
        "refinedQuery": "suggested refined query if partial answer",
        "confidence": float from 0 to 1
      }
    `;

    const analysis = await llmClient.complete({
        prompt,
        responseFormat: { type: "json_object" }
    });

    return JSON.parse(analysis.text);
};

/**
 * Combines partial contexts to form a comprehensive answer
 * @param {String} query - Original query
 * @param {Array} partialContexts - Partial context information collected
 * @param {Array} relevantConversation - Relevant conversation messages
 * @param {Object} llmClient - LLM client
 * @returns {Object} Combined answer
 */
const combinePartialContexts = async (query, partialContexts, relevantConversation, llmClient) => {
    // Extract all relevant data
    const allRelevantData = partialContexts.map(ctx => ctx.relevantParts).join("\n\n");

    // Extract conversation information if available
    const conversationContext = relevantConversation.length > 0
        ? "RELEVANT CONVERSATION:\n" + relevantConversation.join("\n\n")
        : "";

    const prompt = `
      You are generating a comprehensive answer by combining partial information.
      
      QUERY: ${query}
      
      RELEVANT INFORMATION:
      ${allRelevantData}
      
      ${conversationContext}
      
      Generate a comprehensive answer based on all available information.
      If the information is still incomplete, acknowledge the limitations.
      Respond in the following JSON format:
      {
        "answer": "comprehensive answer",
        "confidence": float from 0 to 1,
        "requiresFollowUp": boolean
      }
    `;

    const result = await llmClient.complete({
        prompt,
        responseFormat: { type: "json_object" }
    });

    return JSON.parse(result.text);
};

/**
 * Generates a response for insufficient data scenarios
 * @param {String} query - User query
 * @returns {String} Appropriate response
 */
const generateInsufficientDataResponse = (query) => {
    return `I don't have enough information to fully answer your question about "${query}". Would you like me to elaborate on a specific aspect or provide more details to help me better understand what you're looking for?`;
};
