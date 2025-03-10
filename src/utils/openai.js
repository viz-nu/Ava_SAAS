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
// const getContextMain = async (collectionIds, text) => {
//     const embeddingResult = await EmbeddingFunct(text)
//     try {
//         let context = await Data.aggregate([
//             {
//                 $vectorSearch: {
//                     "exact": false,
//                     "filter": { "collection": { $in: collectionIds } },      // collectionIds will be like [ new ObjectId('67bcb48ed9a4b270b14fa171') ]
//                     "index": "Data",
//                     "path": "embeddingVector",
//                     "queryVector": embeddingResult.data[0].embedding,
//                     "numCandidates": 500,
//                     "limit": 5
//                 }
//             },
//             {
//                 $project: {
//                     content: 1,
//                     chunk_number: 1,
//                     metadata: 1,
//                     summary: 1,
//                     score: { $meta: 'vectorSearchScore' }
//                 }
//             }
//         ])
//         let result = {
//             context: [], data: "", embeddingTokens: {
//                 model: embeddingResult.model,
//                 usage: embeddingResult.usage
//             }
//         }
//         context.forEach((ele) => {
//             result.data += '\n' + ele.content + '\n'
//             result.context.push({ chunk_number: ele.chunk_number, ...ele.metadata, score: ele.score })
//         })
//         return result;
//     } catch (error) {
//         console.error(error);
//         return null;
//     }
// }
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
// /**
//  * Enhanced context retrieval function that intelligently fetches the best context
//  * for answering queries using conversation history, vector search, and LLM analysis
//  * 
//  * @param {Array} collectionIds - Array of collection IDs to search in
//  * @param {String} query - The user's current query
//  * @param {Array} conversationHistory - Previous conversation messages
//  * @param {Number} maxRetries - Maximum number of vector search retries (default: 3)
//  * @returns {Object} The context information and answer status
//  */
// export const getEnhancedContext = async (collectionIds, query, conversationHistory, maxRetries = 3) => {
//     // Initialize result object with a structured format
//     const result = {
//         source: null, // Possible values: 'conversation', 'vectorSearch', 'combined', 'insufficient', 'error'
//         answer: null,
//         context: [],
//         relevantData: [],
//         embeddingTokens: null,
//         partialFromConversation: false,
//         missingElements: null,
//     };

//     try {
//         console.log("[INFO] Starting getEnhancedContext function");
//         console.log("[INFO] Initial Query:", query);

//         // Step 1: Analyze conversation history to check for an existing answer
//         if (conversationHistory && conversationHistory.length > 0) {
//             console.log("[INFO] Checking conversation history for relevant answers...");
//             const conversationAnalysis = await analyzeConversationForAnswer(query, conversationHistory);

//             console.log("[DEBUG] Conversation Analysis Result:", conversationAnalysis);

//             if (conversationAnalysis.answerStatus === "complete" && conversationAnalysis.confidence >= 0.7) {
//                 console.log("[SUCCESS] Found a complete answer in conversation history.");
//                 result.source = 'conversation';
//                 result.answer = conversationAnalysis.answer;
//                 return result;
//             } else if (conversationAnalysis.answerStatus === "partial") {
//                 console.log("[INFO] Found a partial answer in conversation history.");
//                 result.partialFromConversation = true;
//                 result.relevantData.push(conversationAnalysis.answer);
//                 result.missingElements = conversationAnalysis.refinedQuery;
//             }
//         }

//         // Step 2: If partial answer exists, enhance it with vector search
//         if (result.partialFromConversation) {
//             console.log("[INFO] Fetching missing elements using vector search...");
//             let vectorResult = await getContextMain(collectionIds, result.missingElements);
//             console.log("[DEBUG] Vector Search Result:", vectorResult);
            
//             result.embeddingTokens = vectorResult.embeddingTokens;
//             const searchAnalysis = await analyzeSearchResults(query, vectorResult.data);
//             console.log("[DEBUG] Search Analysis Result:", searchAnalysis);

//             if (searchAnalysis.completeAnswer) {
//                 console.log("[SUCCESS] Successfully combined conversation history with vector search data.");
//                 result.source = 'combined';
//                 result.answer = searchAnalysis.answer;
//                 result.context.push(...vectorResult.context);
//                 return result;
//             } else if (searchAnalysis.partialAnswer) {
//                 console.log("[INFO] Still missing information after vector search.");
//                 result.context.push(...vectorResult.context);
//                 result.relevantData.push(searchAnalysis.relevantParts);
//                 result.missingElements = searchAnalysis.refinedQuery || null;
//             }
//         }

//         // Step 3: Perform iterative vector searches with retries
//         let currentQuery = result.missingElements || query;
//         let attempts = 0;
//         while (attempts < maxRetries) {
//             attempts++;
//             console.log(`[INFO] Attempt ${attempts}: Performing vector search for query -`, currentQuery);
            
//             const vectorResult = await getContextMain(collectionIds, currentQuery);
//             if (!vectorResult) break;

//             console.log("[DEBUG] Vector Search Result:", vectorResult);
//             result.embeddingTokens = vectorResult.embeddingTokens;

//             const searchAnalysis = await analyzeSearchResults(query, vectorResult.data);
//             console.log("[DEBUG] Search Analysis Result:", searchAnalysis);

//             if (searchAnalysis.completeAnswer) {
//                 console.log("[SUCCESS] Found a complete answer via vector search.");
//                 result.source = 'vectorSearch';
//                 result.answer = searchAnalysis.answer;
//                 result.context.push(...vectorResult.context);
//                 return result;
//             } else if (searchAnalysis.partialAnswer) {
//                 console.log("[INFO] Partial answer found, refining query...");
//                 result.context.push(...vectorResult.context);
//                 result.relevantData.push(searchAnalysis.relevantParts);
//                 result.missingElements = searchAnalysis.refinedQuery || null;
//                 currentQuery = searchAnalysis.refinedQuery || currentQuery;
//             } else {
//                 console.log("[WARNING] No significant improvement from vector search.");
//                 result.missingElements = searchAnalysis.refinedQuery || null;
//                 currentQuery = searchAnalysis.refinedQuery || currentQuery;
//                 break;
//             }
//         }

//         // Step 4: If relevant data is found, return a partial response
//         if (result.relevantData.length > 0) {
//             console.log("[INFO] Returning partial answer from vector search.");
//             result.source = "vectorSearch";
//             result.answer = result.relevantData.join("\n");
//             return result;
//         }

//         // Step 5: No sufficient answer found
//         console.log("[ERROR] Insufficient data to generate an answer.");
//         result.source = 'insufficient';
//         return result;
//     } catch (error) {
//         console.error("[FATAL ERROR] Exception in getEnhancedContext:", error);
//         return {
//             source: 'error',
//             error: error.message
//         };
//     }
// };


// /**
//  * Analyzes conversation history to find if the answer exists
//  * @param {String} query - Current user query
//  * @param {Array} history - Conversation history
//  * @param {Object} llmClient - LLM client for analysis
//  * @returns {Object} Analysis results
//  */
// const analyzeConversationForAnswer = async (query, history) => {
//     // Prepare conversation context for LLM
//     const conversationContext = history.map(msg => `${msg.role}: ${msg.content}`).join("\n\n");
//     // Prompt for LLM to analyze if the answer exists in conversation
//     const messages = [
//         {
//             role: "system",
//             content: "You are analyzing a conversation to determine if the answer to a question already exists, either completely or partially. Provide your analysis in JSON format."
//         },
//         {
//             role: "user",
//             content: `CONVERSATION: ${conversationContext}
//                 CURRENT QUERY: ${query}
//                 Determine if the answer to the CURRENT QUERY exists in the CONVERSATION, either completely or partially.
//                 Consider the following levels of answers:
//                 1. Complete answer: The conversation contains all information needed to fully answer the query.
//                 2. Partial answer: The conversation contains some relevant information but not a complete answer.
//                 3. No answer: The conversation doesn't contain information relevant to the query.
//                 Respond in the following JSON format:
//                 {
//                   "answerStatus": "complete" | "partial" | "none",
//                   "answer": "extracted or synthesized answer if complete/partial, null if none",
//                   "refinedQuery": "description of what information is missing (for partial or noanswers)",
//                   "confidence": float from 0 to 1,
//                   "shouldUseVectorSearch": boolean
//                 }`
//         }
//     ];
//     try {
//         const response = await openai.chat.completions.create({
//             messages,
//             model: "gpt-4o-mini",
//             response_format: { type: "json_object" }
//         });
//         return response.choices?.[0]?.message?.content ? JSON.parse(response.choices[0].message.content) : { answerStatus: "none", answer: null, refinedQuery: "", confidence: 0, shouldUseVectorSearch: true };
//     } catch (error) {
//         console.error("LLM Conversation analysis error:", error);
//         return { answerStatus: "none", answer: null, refinedQuery: "", confidence: 0, shouldUseVectorSearch: true };
//     }

// };

// /**
//  * Analyzes search results to determine if they answer the query
//  * @param {String} query - User query
//  * @param {String} searchData - Vector search results
//  * @param {Object} llmClient - LLM client for analysis
//  * @returns {Object} Analysis results
//  */
// const analyzeSearchResults = async (query, searchData) => {
//     try {
//         const messages = [
//             {
//                 role: "system",
//                 content: "You are analyzing vector search results to determine if they answer a query. Provide your analysis in JSON format."
//             },
//             {
//                 role: "user",
//                 content: ` QUERY: ${query}
//                 SEARCH RESULTS: ${searchData}
//                 Analyze if these search results fully answer the query, partially answer it, or don't answer it at all.
//                 Respond in the following JSON format:
//                 {
//                   "completeAnswer": boolean,
//                   "partialAnswer": boolean,
//                   "answer": "complete answer if found, null if not",
//                   "relevantParts": "extract of the most relevant parts from search results",
//                   "refinedQuery": "suggested refined query if partial answer",
//                   "confidence": float from 0 to 1
//                 }`
//             }
//         ];
//         const response = await openai.chat.completions.create({
//             messages,
//             model: "gpt-4o-mini",
//             response_format: { type: "json_object" },
//             temperature: 0.1
//         });
//         const result = JSON.parse(response.choices[0].message.content)
//         return {
//             completeAnswer: !!result.completeAnswer,
//             partialAnswer: !!result.partialAnswer,
//             answer: result.answer || null,
//             relevantParts: result.relevantParts || null,
//             refinedQuery: result.refinedQuery || null,
//             confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0
//         };

//     } catch (error) {
//         return {
//             completeAnswer: false,
//             partialAnswer: false,
//             answer: null,
//             relevantParts: null,
//             refinedQuery: null,
//             confidence: 0
//         };
//     }


//     const analysis = await llmClient.complete({
//         prompt,
//         responseFormat: { type: "json_object" }
//     });

//     return JSON.parse(analysis.text);
// };


const getContextMain = async (collectionIds, text, options = {}) => {
    const { numCandidates = 500, limit = 5, minScore = 0.7 } = options;
    const embeddingResult = await EmbeddingFunct(text)
    try {
        // First stage retrieval with more candidates
        let context = await Data.aggregate([
            {
                $vectorSearch: {
                    "exact": false,
                    "filter": { "collection": { $in: collectionIds } },
                    "index": "Data",
                    "path": "embeddingVector",
                    "queryVector": embeddingResult.data[0].embedding,
                    "numCandidates": numCandidates,
                    "limit": Math.max(limit * 3, 10), // Retrieve more documents initially for reranking
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

        // Apply hybrid scoring - normalize vector score and apply BM25-like keyword matching
        const enhancedContext = context.map(doc => {
            // Normalize vector score to 0-1 range
            const normalizedScore = doc.score;

            // Simple keyword matching score (0-1 range)
            const keywords = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const contentLower = doc.content.toLowerCase();
            const keywordMatches = keywords.filter(k => contentLower.includes(k)).length;
            const keywordScore = keywords.length > 0 ? keywordMatches / keywords.length : 0;

            // Combine scores (70% vector, 30% keyword)
            const hybridScore = normalizedScore * 0.7 + keywordScore * 0.3;

            return {
                ...doc,
                originalScore: doc.score,
                keywordScore,
                hybridScore
            };
        });

        // Filter by minimum score and sort by hybrid score
        const filteredContext = enhancedContext
            .filter(doc => doc.hybridScore >= minScore)
            .sort((a, b) => b.hybridScore - a.hybridScore)
            .slice(0, limit);

        let result = {
            context: [],
            data: "",
            embeddingTokens: {
                model: embeddingResult.model,
                usage: embeddingResult.usage
            },
            scoringMetrics: {
                retrieved: context.length,
                afterFiltering: filteredContext.length
            }
        };

        filteredContext.forEach((ele) => {
            result.data += '\n' + ele.content + '\n';
            result.context.push({
                chunk_number: ele.chunk_number,
                ...ele.metadata,
                originalScore: ele.originalScore,
                hybridScore: ele.hybridScore
            });
        });

        return result;
    } catch (error) {
        console.error(error);
        return null;
    }
}
/**
 * Enhanced context retrieval function with improved search accuracy and efficiency
 * 
 * @param {Array} collectionIds - Array of collection IDs to search in
 * @param {String} query - The user's current query
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Number} maxRetries - Maximum number of vector search retries (default: 2)
 * @returns {Object} The context information and answer status
 */
export const getEnhancedContext = async (collectionIds, query, conversationHistory, maxRetries = 2) => {
    // Initialize result object with a structured format
    const result = {
        source: null,
        answer: null,
        context: [],
        relevantData: [],
        embeddingTokens: null,
        partialFromConversation: false,
        missingElements: null,
        metrics: {
            queriesAttempted: 0,
            tokensUsed: 0
        }
    };

    try {
        // Stage 1: Extract and expand the query
        const expandedQuery = await expandAndOptimizeQuery(query, conversationHistory);
        console.log("[INFO] Expanded Query:", expandedQuery.optimizedQuery);
        result.metrics.tokensUsed += expandedQuery.tokensUsed || 0;

        // Track if conversation had useful context
        let conversationHasContext = false;
        let conversationConfidence = 0;

        // Stage 2: Analyze conversation history for possible answers
        if (conversationHistory && conversationHistory.length > 0) {
            console.log("[INFO] Checking conversation history for relevant answers...");
            const conversationAnalysis = await analyzeConversationForAnswer(query, conversationHistory);
            result.metrics.tokensUsed += conversationAnalysis.tokensUsed || 0;
            conversationConfidence = conversationAnalysis.confidence || 0;

            if (conversationAnalysis.answerStatus === "complete" && conversationAnalysis.confidence >= 0.85) {
                console.log("[SUCCESS] Found a complete answer in conversation history.");
                result.source = 'conversation';
                result.answer = conversationAnalysis.answer;
                return result;
            } else if (conversationAnalysis.answerStatus === "partial" && conversationAnalysis.confidence >= 0.6) {
                console.log("[INFO] Found a partial answer in conversation history.");
                result.partialFromConversation = true;
                result.relevantData.push(conversationAnalysis.answer);
                result.missingElements = conversationAnalysis.refinedQuery;
                conversationHasContext = true;
            }
        }

        // Stage 3: Perform main vector search with enhanced parameters
        result.metrics.queriesAttempted++;
        const searchOptions = {
            numCandidates: 800,         // More candidates for better recall
            limit: conversationHasContext ? 3 : 5,  // Fewer if we already have context
            minScore: 0.65              // Minimum relevance threshold
        };

        // Use the optimized query from expansion
        const mainQueryText = expandedQuery.optimizedQuery || query;
        console.log("[INFO] Performing primary vector search with query:", mainQueryText);

        const vectorResult = await getContextMain(collectionIds, mainQueryText, searchOptions);
        if (!vectorResult) {
            result.source = 'error';
            return result;
        }

        result.embeddingTokens = vectorResult.embeddingTokens;
        result.context.push(...vectorResult.context);

        // Stage 4: Analyze search results for completeness
        const searchAnalysis = await analyzeSearchResults(query, vectorResult.data, {
            useGPT4: true,  // Use more powerful model for critical analysis
            includeContextConfidence: true
        });
        result.metrics.tokensUsed += searchAnalysis.tokensUsed || 0;

        // If we have both conversation context and vector search results, combine them
        if (conversationHasContext && searchAnalysis.partialAnswer) {
            console.log("[INFO] Combining conversation history with vector search data...");
            const combinedAnalysis = await combineContextSources(
                query,
                result.relevantData.join("\n"),
                vectorResult.data,
                conversationConfidence,
                searchAnalysis.confidence
            );
            result.metrics.tokensUsed += combinedAnalysis.tokensUsed || 0;

            if (combinedAnalysis.completeAnswer) {
                console.log("[SUCCESS] Successfully combined sources to create complete answer.");
                result.source = 'combined';
                result.answer = combinedAnalysis.answer;

                return result;
            }
        }

        // Handle search results if they're sufficient on their own
        if (searchAnalysis.completeAnswer && searchAnalysis.confidence >= 0.8) {
            console.log("[SUCCESS] Found a complete answer via vector search.");
            result.source = 'vectorSearch';
            result.answer = searchAnalysis.answer;

            return result;
        }

        // Stage 5: Smart retry strategy for incomplete answers
        if (searchAnalysis.partialAnswer || result.relevantData.length > 0) {
            console.log("[INFO] Partial information found. Planning targeted follow-up searches.");

            // Determine what information is still missing
            const missingInfo = searchAnalysis.refinedQuery || expandedQuery.additionalQueries[0] || null;
            if (!missingInfo) {
                // If no specific missing info identified but we have partial answers,
                // return the best we have
                console.log("[INFO] No specific missing information identified. Returning partial results.");
                result.source = result.partialFromConversation ? 'combined' : 'vectorSearch';
                result.answer = searchAnalysis.relevantParts || vectorResult.data;
                return result;
            }

            // Add the relevant parts from the first search to our collection
            if (searchAnalysis.relevantParts) {
                result.relevantData.push(searchAnalysis.relevantParts);
            }

            // Perform targeted follow-up searches
            for (let i = 0; i < Math.min(maxRetries, 2); i++) {
                result.metrics.queriesAttempted++;
                // Use either the missing info query or one of the expanded queries
                const followUpQuery = missingInfo || expandedQuery.additionalQueries[i] || query;

                console.log(`[INFO] Follow-up search ${i + 1}/${maxRetries}: ${followUpQuery}`);

                const followUpOptions = {
                    numCandidates: 600,
                    limit: 3,
                    minScore: 0.6  // Lower threshold for follow-up searches
                };

                const followUpResult = await getContextMain(collectionIds, followUpQuery, followUpOptions);
                if (!followUpResult) continue;

                // Add new context but avoid duplicates
                const existingChunkIds = new Set(result.context.map(c => c.chunk_number));
                followUpResult.context.forEach(chunk => {
                    if (!existingChunkIds.has(chunk.chunk_number)) {
                        result.context.push(chunk);
                        existingChunkIds.add(chunk.chunk_number);
                    }
                });

                // Analyze this follow-up result
                const followUpAnalysis = await analyzeSearchResults(followUpQuery, followUpResult.data);
                result.metrics.tokensUsed += followUpAnalysis.tokensUsed || 0;

                if (followUpAnalysis.relevantParts) {
                    result.relevantData.push(followUpAnalysis.relevantParts);
                }

                // Check if we now have enough information to answer
                if (followUpAnalysis.completeAnswer && followUpAnalysis.confidence >= 0.75) {
                    console.log("[SUCCESS] Follow-up search provided complete answer.");
                    result.source = 'vectorSearch';
                    result.answer = followUpAnalysis.answer;
                    return result;
                }
            }

            // Stage 6: Final synthesis of all collected information
            if (result.relevantData.length > 0) {
                console.log("[INFO] Synthesizing final answer from all gathered information.");
                const allRelevantData = result.relevantData.join("\n\n");
                result.source = 'relavant';
                result.answer = allRelevantData;
            } else {
                console.log("[WARNING] No relevant data found after all searches.");
                result.source = 'insufficient';
            }
        } else {
            console.log("[WARNING] Initial search provided no relevant information.");
            result.source = 'insufficient';
        }
        return result;
    } catch (error) {
        console.error("[FATAL ERROR] Exception in getEnhancedContext:", error);
        return {
            source: 'error',
            error: error.message,
            metrics: {
                ...result.metrics,
                error: error.toString()
            }
        };
    }
};

/**
 * Expands and optimizes the query to improve search results
 * @param {String} query - Original user query
 * @param {Array} history - Conversation history
 * @returns {Object} Optimized query and additional queries
 */
const expandAndOptimizeQuery = async (query, history = []) => {
    try {
        // Create proper context from history
        const recentHistory = history.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join("\n\n");

        const messages = [
            {
                role: "system",
                content: "You are a search query optimizer that enhances queries to improve retrieval results. Your task is to identify the core information need and create an optimized search query."
            },
            {
                role: "user",
                content: `ORIGINAL QUERY: ${query}
                ${history.length > 0 ? `\nRECENT CONVERSATION:\n${recentHistory}` : ''}
                
                Please:
                1. Identify the core information need
                2. Create an optimized, expanded query with relevant keywords
                3. Suggest 1-2 alternative queries that might capture different aspects
                
                Return your analysis in JSON format.`
            }
        ];

        const response = await openai.chat.completions.create({
            messages,
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.3
        });

        const result = JSON.parse(response.choices[0].message.content);
        return {
            optimizedQuery: result.optimizedQuery || query,
            additionalQueries: result.alternativeQueries || [],
            coreInformationNeed: result.coreInformationNeed || null,
            tokensUsed: response.usage.total_tokens
        };
    } catch (error) {
        console.error("Query optimization error:", error);
        return { optimizedQuery: query, additionalQueries: [], tokensUsed: 0 };
    }
};

/**
 * Combines multiple sources of context to create a comprehensive answer
 */
const combineContextSources = async (query, conversationContext, vectorContext, convConfidence, vectorConfidence) => {
    try {
        const messages = [
            {
                role: "system",
                content: "You are analyzing multiple sources of information to create a comprehensive answer."
            },
            {
                role: "user",
                content: `QUERY: ${query}
                
                CONVERSATION CONTEXT (Confidence: ${convConfidence.toFixed(2)}):
                ${conversationContext}
                
                VECTOR SEARCH CONTEXT (Confidence: ${vectorConfidence.toFixed(2)}):
                ${vectorContext}
                
                Combine these sources to create the most comprehensive answer.
                Respond in the following JSON format:
                {
                  "completeAnswer": boolean,
                  "answer": "comprehensive answer combining both sources",
                  "missingElements": "description of any information still missing",
                  "confidence": float from 0 to 1
                }`
            }
        ];

        const response = await openai.chat.completions.create({
            messages,
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        const result = JSON.parse(response.choices[0].message.content);
        return {
            completeAnswer: !!result.completeAnswer,
            answer: result.answer || null,
            missingElements: result.missingElements || null,
            confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0,
            tokensUsed: response.usage.total_tokens
        };
    } catch (error) {
        console.error("Context combination error:", error);
        return {
            completeAnswer: false,
            answer: null,
            missingElements: "Error combining context sources",
            confidence: 0,
            tokensUsed: 0
        };
    }
};
/**
 * Analyzes conversation history to find if the answer exists
 * @param {String} query - Current user query
 * @param {Array} history - Conversation history
 * @returns {Object} Analysis results with token usage
 */
const analyzeConversationForAnswer = async (query, history) => {
    // Implementation enhanced from original with added token usage tracking
    try {
        // Prepare conversation context
        const conversationContext = history.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join("\n\n");

        const messages = [
            {
                role: "system",
                content: "You are analyzing a conversation to determine if the answer to a question already exists. Provide a detailed analysis in JSON format."
            },
            {
                role: "user",
                content: `CURRENT QUERY: ${query}
                CONVERSATION: ${conversationContext}
                
                Determine if the answer to the CURRENT QUERY exists in the CONVERSATION.
                Consider the following levels of answers:
                1. Complete answer: The conversation contains all information needed to fully answer the query.
                2. Partial answer: The conversation contains some relevant information but not a complete answer.
                3. No answer: The conversation doesn't contain information relevant to the query.
                
                Respond in the following JSON format:
                {
                  "answerStatus": "complete" | "partial" | "none",
                  "answer": "extracted or synthesized answer if complete/partial, null if none",
                  "refinedQuery": "description of what information is missing (for partial or no answers)",
                  "confidence": float from 0 to 1,
                  "reasoningExplanation": "brief explanation of your assessment"
                }`
            }
        ];

        const response = await openai.chat.completions.create({
            messages,
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        const result = JSON.parse(response.choices[0].message.content);
        return {
            ...result,
            tokensUsed: response.usage.total_tokens
        };
    } catch (error) {
        console.error("Conversation analysis error:", error);
        return {
            answerStatus: "none",
            answer: null,
            refinedQuery: query,
            confidence: 0,
            tokensUsed: 0
        };
    }
};
/**
 * Analyzes search results to determine if they answer the query
 * @param {String} query - User query
 * @param {String} searchData - Vector search results
 * @param {Object} options - Additional options
 * @returns {Object} Analysis results with token usage
 */
const analyzeSearchResults = async (query, searchData, options = {}) => {
    const { useGPT4 = false, includeContextConfidence = false } = options;

    try {
        const modelToUse = useGPT4 ? "gpt-4o" : "gpt-4o-mini";

        const contextPrompt = includeContextConfidence ?
            `For each piece of information, assess how confident you are that it's relevant and accurate (0-1).` : '';

        const messages = [
            {
                role: "system",
                content: "You are analyzing search results to determine if they answer a query. You are thorough and precise in your evaluation."
            },
            {
                role: "user",
                content: `QUERY: ${query}
                
                SEARCH RESULTS: ${searchData}
                
                Analyze if these search results fully answer the query, partially answer it, or don't answer it at all.
                ${contextPrompt}
                
                Respond in the following JSON format:
                {
                  "completeAnswer": boolean,
                  "partialAnswer": boolean,
                  "answer": "complete answer if found, null if not",
                  "relevantParts": "extract of the most relevant parts from search results",
                  "refinedQuery": "suggested refined query if partial answer",
                  "confidence": float from 0 to 1,
                  "analysisExplanation": "brief explanation of your assessment"
                  ${includeContextConfidence ? ',\n  "contextConfidenceScores": [{"excerpt": "...", "confidence": 0.x}, ...]' : ''}
                }`
            }
        ];

        const response = await openai.chat.completions.create({
            messages,
            model: modelToUse,
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const result = JSON.parse(response.choices[0].message.content);
        return {
            completeAnswer: !!result.completeAnswer,
            partialAnswer: !!result.partialAnswer,
            answer: result.answer || null,
            relevantParts: result.relevantParts || null,
            refinedQuery: result.refinedQuery || null,
            confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0,
            contextConfidenceScores: result.contextConfidenceScores || null,
            tokensUsed: response.usage.total_tokens
        };
    } catch (error) {
        console.error("Search results analysis error:", error);
        return {
            completeAnswer: false,
            partialAnswer: false,
            answer: null,
            relevantParts: null,
            refinedQuery: null,
            confidence: 0,
            tokensUsed: 0
        };
    }
};