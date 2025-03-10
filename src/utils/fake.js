// /**
//  * Enhanced Context Retrieval System
//  * 
//  * A production-grade implementation for intelligently retrieving context
//  * by analyzing conversation history and performing vector searches.
//  * 
//  * @author Your Name
//  * @version 1.0.0
//  */

// require('dotenv').config();
// const { OpenAI } = require('openai');
// const mongoose = require('mongoose');
// const pino = require('pino');

// // Configure logger
// const logger = pino({
//   level: process.env.LOG_LEVEL || 'info',
//   transport: {
//     target: 'pino-pretty',
//     options: {
//       colorize: true
//     }
//   }
// });

// /**
//  * Main context retrieval function
//  * 
//  * @param {Array<mongoose.Types.ObjectId>} collectionIds - MongoDB collection IDs to search
//  * @param {String} query - User's current query
//  * @param {Array<Object>} conversationHistory - Previous conversation messages
//  * @param {Object} options - Configuration options
//  * @returns {Promise<Object>} Enhanced context and answer information
//  */
// async function getEnhancedContext(collectionIds, query, conversationHistory, options = {}) {
//   const {
//     maxRetries = 3,
//     confidenceThreshold = 0.7,
//     openaiApiKey = process.env.OPENAI_API_KEY,
//     openaiModel = 'gpt-4o-mini',
//     timeout = 30000, // 30 seconds timeout
//     cacheResults = true,
//     enableTelemetry = true
//   } = options;

//   // Performance monitoring
//   const startTime = Date.now();
//   let telemetryData = enableTelemetry ? {
//     queryLength: query.length,
//     conversationLength: conversationHistory ? conversationHistory.length : 0,
//     startTime,
//     steps: []
//   } : null;

//   // Initialize OpenAI client
//   const openai = new OpenAI({
//     apiKey: openaiApiKey,
//     timeout: timeout
//   });
  
//   // Initialize result object with scalable structure
//   const result = {
//     source: null, // 'conversation', 'vectorSearch', 'combined', 'insufficient'
//     answer: null,
//     context: [],
//     relevantConversation: [],
//     vectorSearchAttempts: 0,
//     embeddingTokens: null,
//     confidence: 0,
//     requiresFollowUp: false,
//     partialFromConversation: false,
//     missingElements: null,
//     suggestedFollowUp: null,
//     processingTimeMs: 0,
//     cacheHit: false
//   };
  
//   // Check cache if enabled
//   if (cacheResults) {
//     const cachedResult = await checkCache(collectionIds, query);
//     if (cachedResult) {
//       logger.info({ query, source: 'cache' }, 'Cache hit for query');
//       cachedResult.cacheHit = true;
//       return cachedResult;
//     }
//   }

//   try {
//     // Step 1: Analyze conversation history if available
//     if (conversationHistory && conversationHistory.length > 0) {
//       logger.debug({ query }, 'Analyzing conversation history');
      
//       const conversationAnalysisStart = Date.now();
//       const conversationAnalysis = await analyzeConversationForAnswer(query, conversationHistory, openai, openaiModel);
      
//       if (enableTelemetry) {
//         telemetryData.steps.push({
//           step: 'conversationAnalysis',
//           durationMs: Date.now() - conversationAnalysisStart,
//           answerStatus: conversationAnalysis.answerStatus,
//           confidence: conversationAnalysis.confidence
//         });
//       }
      
//       // Store relevant conversation parts for potential later use
//       if (conversationAnalysis.relevantMessages && conversationAnalysis.relevantMessages.length > 0) {
//         result.relevantConversation = conversationAnalysis.relevantMessages.map(index => {
//           try {
//             return conversationHistory[index];
//           } catch (e) {
//             logger.warn({ index, error: e.message }, 'Invalid conversation index');
//             return null;
//           }
//         }).filter(Boolean);
//       }
      
//       if (conversationAnalysis.answerStatus === "complete" && conversationAnalysis.confidence >= confidenceThreshold) {
//         // Complete answer found in conversation with sufficient confidence
//         result.source = 'conversation';
//         result.answer = conversationAnalysis.answer;
//         result.confidence = conversationAnalysis.confidence;
        
//         logger.info({
//           query,
//           source: 'conversation',
//           confidence: result.confidence,
//           duration: Date.now() - startTime
//         }, 'Complete answer found in conversation');
        
//         result.processingTimeMs = Date.now() - startTime;
        
//         // Cache result if enabled
//         if (cacheResults) {
//           await cacheResult(collectionIds, query, result);
//         }
        
//         // Log telemetry
//         if (enableTelemetry) {
//           logTelemetry({
//             ...telemetryData,
//             outcome: 'success',
//             source: 'conversation',
//             totalDurationMs: result.processingTimeMs
//           });
//         }
        
//         return result;
//       } else if (conversationAnalysis.answerStatus === "partial") {
//         // Partial answer in conversation - store it for later combination
//         result.partialFromConversation = true;
//         result.missingElements = conversationAnalysis.missingElements;
        
//         logger.debug({
//           query,
//           confidence: conversationAnalysis.confidence,
//           missingElements: result.missingElements
//         }, 'Partial answer found in conversation');
        
//         // Only return if confidence is high enough and LLM recommends not using vector search
//         if (conversationAnalysis.confidence > 0.8 && !conversationAnalysis.shouldUseVectorSearch) {
//           result.source = 'conversation';
//           result.answer = conversationAnalysis.answer;
//           result.confidence = conversationAnalysis.confidence;
//           result.requiresFollowUp = true;
//           result.suggestedFollowUp = `Could you tell me more about ${result.missingElements}?`;
          
//           result.processingTimeMs = Date.now() - startTime;
          
//           logger.info({
//             query,
//             source: 'partial_conversation',
//             confidence: result.confidence,
//             duration: result.processingTimeMs
//           }, 'Using high-confidence partial answer from conversation');
          
//           // Log telemetry
//           if (enableTelemetry) {
//             logTelemetry({
//               ...telemetryData,
//               outcome: 'partial_success',
//               source: 'conversation',
//               totalDurationMs: result.processingTimeMs
//             });
//           }
          
//           return result;
//         }
//       }
//     }
    
//     // Step 2: Perform vector search and progressive refinement
//     let currentQuery = query;
//     // If we have missing elements identified from conversation, focus the search
//     if (result.missingElements) {
//       currentQuery = `${query} ${result.missingElements}`;
//       logger.debug({ enhancedQuery: currentQuery }, 'Enhanced query with missing elements');
//     }
    
//     let partialContexts = [];
//     let attempts = 0;
    
//     while (attempts < maxRetries) {
//       attempts++;
//       result.vectorSearchAttempts = attempts;
      
//       logger.debug({ attempt: attempts, query: currentQuery }, 'Performing vector search');
      
//       // Track vector search performance
//       const vectorSearchStart = Date.now();
      
//       // Get vector search results
//       const vectorResult = await performVectorSearch(collectionIds, currentQuery);
      
//       if (enableTelemetry) {
//         telemetryData.steps.push({
//           step: `vectorSearch_${attempts}`,
//           durationMs: Date.now() - vectorSearchStart,
//           success: !!vectorResult
//         });
//       }
      
//       if (!vectorResult) {
//         logger.warn({ attempt: attempts }, 'Vector search returned no results');
//         break;
//       }
      
//       result.embeddingTokens = vectorResult.embeddingTokens;
      
//       // Analyze if vector search results answer the query
//       logger.debug({ attempt: attempts }, 'Analyzing vector search results');
      
//       const searchAnalysisStart = Date.now();
//       const searchAnalysis = await analyzeSearchResults(query, vectorResult.data, openai, openaiModel);
      
//       if (enableTelemetry) {
//         telemetryData.steps.push({
//           step: `searchAnalysis_${attempts}`,
//           durationMs: Date.now() - searchAnalysisStart,
//           completeAnswer: searchAnalysis.completeAnswer,
//           partialAnswer: searchAnalysis.partialAnswer,
//           confidence: searchAnalysis.confidence
//         });
//       }
      
//       if (searchAnalysis.completeAnswer) {
//         // We have a complete answer from vector search
//         result.source = 'vectorSearch';
//         result.answer = searchAnalysis.answer;
//         result.context = [...vectorResult.context];
//         result.confidence = searchAnalysis.confidence;
        
//         logger.info({
//           query,
//           source: 'vectorSearch',
//           confidence: result.confidence,
//           attempts
//         }, 'Complete answer found from vector search');
        
//         result.processingTimeMs = Date.now() - startTime;
        
//         // Cache result if enabled
//         if (cacheResults) {
//           await cacheResult(collectionIds, query, result);
//         }
        
//         // Log telemetry
//         if (enableTelemetry) {
//           logTelemetry({
//             ...telemetryData,
//             outcome: 'success',
//             source: 'vectorSearch',
//             attempts,
//             totalDurationMs: result.processingTimeMs
//           });
//         }
        
//         return result;
//       } else if (searchAnalysis.partialAnswer) {
//         // Store partial context for combined answer later
//         logger.debug({ 
//           attempt: attempts,
//           confidence: searchAnalysis.confidence,
//           refinedQuery: searchAnalysis.refinedQuery
//         }, 'Partial answer found from vector search');
        
//         partialContexts.push({
//           data: vectorResult.data,
//           context: vectorResult.context,
//           relevantParts: searchAnalysis.relevantParts,
//           confidence: searchAnalysis.confidence
//         });
        
//         // Refine query for next attempt
//         if (searchAnalysis.refinedQuery && searchAnalysis.refinedQuery !== currentQuery) {
//           currentQuery = searchAnalysis.refinedQuery;
//           logger.debug({ refinedQuery: currentQuery }, 'Query refined for next attempt');
//         } else {
//           // If no query refinement suggested, break the loop to avoid redundant searches
//           logger.debug('No query refinement suggested, stopping iterations');
//           break;
//         }
//       } else {
//         // No useful information found
//         logger.debug({ attempt: attempts }, 'No useful information found in vector search');
//         break;
//       }
//     }
    
//     // Step 3: Combine partial contexts if we have any
//     if (partialContexts.length > 0 || result.partialFromConversation) {
//       logger.info({
//         partialContexts: partialContexts.length,
//         partialFromConversation: result.partialFromConversation
//       }, 'Combining partial contexts');
      
//       const combinationStart = Date.now();
      
//       const combinedAnswer = await combinePartialContexts(
//         query, 
//         partialContexts, 
//         result.relevantConversation,
//         result.partialFromConversation ? result.missingElements : null,
//         openai,
//         openaiModel
//       );
      
//       if (enableTelemetry) {
//         telemetryData.steps.push({
//           step: 'combinePartialContexts',
//           durationMs: Date.now() - combinationStart,
//           confidence: combinedAnswer.confidence,
//           requiresFollowUp: combinedAnswer.requiresFollowUp
//         });
//       }
      
//       result.source = 'combined';
//       result.answer = combinedAnswer.answer;
//       result.context = partialContexts.flatMap(pc => pc.context);
//       result.confidence = combinedAnswer.confidence;
//       result.requiresFollowUp = combinedAnswer.requiresFollowUp;
//       result.suggestedFollowUp = combinedAnswer.suggestedFollowUp;
      
//       logger.info({
//         query,
//         source: 'combined',
//         confidence: result.confidence,
//         requiresFollowUp: result.requiresFollowUp
//       }, 'Combined answer generated');
      
//       result.processingTimeMs = Date.now() - startTime;
      
//       // Cache result if confidence is high enough
//       if (cacheResults && result.confidence >= confidenceThreshold) {
//         await cacheResult(collectionIds, query, result);
//       }
      
//       // Log telemetry
//       if (enableTelemetry) {
//         logTelemetry({
//           ...telemetryData,
//           outcome: result.requiresFollowUp ? 'partial_success' : 'success',
//           source: 'combined',
//           totalDurationMs: result.processingTimeMs
//         });
//       }
      
//       return result;
//     }
    
//     // Step 4: If we reach here, we couldn't find a satisfactory answer
//     logger.warn({ query }, 'Insufficient data to answer query');
    
//     result.source = 'insufficient';
//     result.answer = generateInsufficientDataResponse(query);
//     result.confidence = 0.1;
//     result.requiresFollowUp = true;
//     result.suggestedFollowUp = "Could you provide more specific information about what you're looking for?";
    
//     result.processingTimeMs = Date.now() - startTime;
    
//     // Log telemetry
//     if (enableTelemetry) {
//       logTelemetry({
//         ...telemetryData,
//         outcome: 'insufficient_data',
//         totalDurationMs: result.processingTimeMs
//       });
//     }
    
//     return result;
    
//   } catch (error) {
//     const errorTime = Date.now();
//     const errorDuration = errorTime - startTime;
    
//     logger.error({
//       query,
//       error: error.message,
//       stack: error.stack,
//       duration: errorDuration
//     }, 'Error in getEnhancedContext');
    
//     // Log telemetry
//     if (enableTelemetry) {
//       logTelemetry({
//         ...telemetryData,
//         outcome: 'error',
//         error: error.message,
//         totalDurationMs: errorDuration
//       });
//     }
    
//     return {
//       source: 'error',
//       error: error.message,
//       errorDetails: process.env.NODE_ENV === 'development' ? error.stack : undefined,
//       context: [],
//       relevantConversation: [],
//       vectorSearchAttempts: result.vectorSearchAttempts,
//       processingTimeMs: errorDuration
//     };
//   }
// }

// /**
//  * Performs vector search using the embedding function
//  * @param {Array} collectionIds - Collection IDs to search in
//  * @param {String} text - Text to find embeddings for
//  * @returns {Promise<Object>} Search results and context
//  */
// async function performVectorSearch(collectionIds, text) {
//   try {
//     const embeddingResult = await EmbeddingFunct(text);
    
//     // Validate embedding result
//     if (!embeddingResult || !embeddingResult.data || !embeddingResult.data[0] || !embeddingResult.data[0].embedding) {
//       logger.error({ text: text.substring(0, 100) }, 'Invalid embedding result');
//       return null;
//     }
    
//     // Ensure collectionIds are properly formatted for MongoDB query
//     const formattedCollectionIds = collectionIds.map(id => {
//       if (typeof id === 'string') {
//         try {
//           return new mongoose.Types.ObjectId(id);
//         } catch (e) {
//           logger.warn({ id }, 'Invalid ObjectId format');
//           return null;
//         }
//       }
//       return id;
//     }).filter(Boolean);
    
//     if (formattedCollectionIds.length === 0) {
//       logger.warn('No valid collection IDs provided');
//       return null;
//     }
    
//     // Perform vector search with timeout
//     const searchPromise = Data.aggregate([
//       {
//         $vectorSearch: {
//           exact: false,
//           filter: { collection: { $in: formattedCollectionIds } },
//           index: "Data",
//           path: "embeddingVector",
//           queryVector: embeddingResult.data[0].embedding,
//           numCandidates: 500,
//           limit: 5
//         }
//       },
//       {
//         $project: {
//           content: 1,
//           chunk_number: 1,
//           metadata: 1,
//           summary: 1,
//           score: { $meta: 'vectorSearchScore' }
//         }
//       }
//     ]).exec();
    
//     // Add timeout to prevent long-running queries
//     const context = await Promise.race([
//       searchPromise,
//       new Promise((_, reject) => 
//         setTimeout(() => reject(new Error('Vector search timeout')), 10000)
//       )
//     ]);
    
//     // Handle empty results
//     if (!context || context.length === 0) {
//       logger.debug({ text: text.substring(0, 100) }, 'No results from vector search');
//       return null;
//     }
    
//     let result = {
//       context: [],
//       data: "",
//       embeddingTokens: {
//         model: embeddingResult.model,
//         usage: embeddingResult.usage
//       }
//     };
    
//     // Process and sanitize search results
//     context.forEach((ele) => {
//       if (ele && ele.content) {
//         result.data += '\n' + ele.content + '\n';
//         result.context.push({ 
//           chunk_number: ele.chunk_number, 
//           ...(ele.metadata || {}), 
//           score: ele.score || 0
//         });
//       }
//     });
    
//     // Return null if no valid content was found
//     if (result.data.trim() === '') {
//       logger.debug('No valid content in search results');
//       return null;
//     }
    
//     return result;
//   } catch (error) {
//     logger.error({
//       error: error.message, 
//       text: text.substring(0, 100)
//     }, 'Error in performVectorSearch');
//     return null;
//   }
// }



// /**
//  * Analyzes search results to determine if they answer the query
//  * @param {String} query - User query
//  * @param {String} searchData - Vector search results
//  * @param {Object} openai - OpenAI client
//  * @param {String} model - OpenAI model to use
//  * @returns {Promise<Object>} Analysis results
//  */
// async function analyzeSearchResults(query, searchData, openai, model = 'gpt-4o-mini') {
//   try {
//     // Truncate searchData if it's too large
//     const maxLength = 8000; // Reasonable limit to avoid token limitations
//     const truncatedData = searchData.length > maxLength 
//       ? searchData.substring(0, maxLength) + "... [truncated due to length]" 
//       : searchData;
    
//     const messages = [
//       {
//         role: "system",
//         content: "You are analyzing vector search results to determine if they answer a query. Provide your analysis in JSON format."
//       },
//       {
//         role: "user",
//         content: `
//           QUERY: ${query}
          
//           SEARCH RESULTS:
//           ${truncatedData}
          
//           Analyze if these search results fully answer the query, partially answer it, or don't answer it at all.
//           Respond in the following JSON format:
//           {
//             "completeAnswer": boolean,
//             "partialAnswer": boolean,
//             "answer": "complete answer if found, null if not",
//             "relevantParts": "extract of the most relevant parts from search results",
//             "refinedQuery": "suggested refined query if partial answer",
//             "confidence": float from 0 to 1
//           }
//         `
//       }
//     ];
    
//     // Call OpenAI with retry logic
//     const response = await retryAsyncOperation(
//       () => openai.chat.completions.create({
//         model: model,
//         messages: messages,
//         response_format: { type: "json_object" },
//         temperature: 0.1
//       }),
//       3, // Max 3 retries
//       1000 // Initial delay of 1 second
//     );
    
//     if (!response || !response.choices || !response.choices[0].message || !response.choices[0].message.content) {
//       logger.warn('Invalid response from OpenAI during search results analysis');
//       return {
//         completeAnswer: false,
//         partialAnswer: false,
//         answer: null,
//         relevantParts: null,
//         refinedQuery: null,
//         confidence: 0
//       };
//     }
    
//     try {
//       const result = JSON.parse(response.choices[0].message.content);
      
//       // Validate and sanitize the response
//       return {
//         completeAnswer: !!result.completeAnswer,
//         partialAnswer: !!result.partialAnswer,
//         answer: result.answer || null,
//         relevantParts: result.relevantParts || null,
//         refinedQuery: result.refinedQuery || null,
//         confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0
//       };
//     } catch (parseError) {
//       logger.error({
//         error: parseError.message,
//         content: response.choices[0].message.content.substring(0, 200)
//       }, 'Error parsing search analysis JSON');
      
//       return {
//         completeAnswer: false,
//         partialAnswer: false,
//         answer: null,
//         relevantParts: null,
//         refinedQuery: null,
//         confidence: 0
//       };
//     }
//   } catch (error) {
//     logger.error({
//       error: error.message,
//       query: query.substring(0, 100)
//     }, 'Error in analyzeSearchResults');
    
//     return {
//       completeAnswer: false,
//       partialAnswer: false,
//       answer: null,
//       relevantParts: null,
//       refinedQuery: null,
//       confidence: 0
//     };
//   }
// }

// /**
//  * Combines partial contexts to form a comprehensive answer
//  * @param {String} query - Original query
//  * @param {Array} partialContexts - Partial context information collected
//  * @param {Array} relevantConversation - Relevant conversation messages
//  * @param {String|null} missingElements - Description of missing information
//  * @param {Object} openai - OpenAI client
//  * @param {String} model - OpenAI model to use
//  * @returns {Promise<Object>} Combined answer
//  */
// async function combinePartialContexts(query, partialContexts, relevantConversation, missingElements, openai, model = 'gpt-4o-mini') {
//   try {
//     // Extract all relevant data from vector search
//     const vectorData = partialContexts.length > 0 
//       ? "RELEVANT VECTOR SEARCH RESULTS:\n" + partialContexts.map(ctx => ctx.relevantParts).join("\n\n")
//       : "";
    
//     // Extract conversation information if available
//     const conversationContext = relevantConversation && relevantConversation.length > 0 
//       ? "RELEVANT CONVERSATION:\n" + relevantConversation.map(msg => {
//           if (!msg || !msg.role || !msg.content) return "";
//           return `${msg.role}: ${msg.content}`;
//         }).filter(Boolean).join("\n\n")
//       : "";
    
//     // Include information about what's missing if we have it
//     const missingInfo = missingElements 
//       ? `IDENTIFIED MISSING INFORMATION: ${missingElements}`
//       : "";
    
//     // Truncate data if necessary to avoid token limitations
//     const maxInputLength = 10000;
//     let combinedInput = `${vectorData}\n\n${conversationContext}\n\n${missingInfo}`;
//     if (combinedInput.length > maxInputLength) {
//       logger.debug('Truncating input for context combination due to length');
//       const vectorLength = Math.floor(maxInputLength * 0.7); // Allocate 70% to vector data
//       const conversationLength = Math.floor(maxInputLength * 0.25); // 25% to conversation
//       const missingLength = Math.floor(maxInputLength * 0.05); // 5% to missing info
      
//       const truncatedVector = vectorData.length > vectorLength
//         ? vectorData.substring(0, vectorLength) + "... [truncated]"
//         : vectorData;
        
//       const truncatedConversation = conversationContext.length > conversationLength
//         ? conversationContext.substring(0, conversationLength) + "... [truncated]"
//         : conversationContext;
        
//       const truncatedMissing = missingInfo.length > missingLength
//         ? missingInfo.substring(0, missingLength) + "... [truncated]"
//         : missingInfo;
        
//       combinedInput = `${truncatedVector}\n\n${truncatedConversation}\n\n${truncatedMissing}`;
//     }
    
//     const messages = [
//       {
//         role: "system",
//         content: "You are generating a comprehensive answer by combining partial information. Provide your response in JSON format."
//       },
//       {
//         role: "user",
//         content: `
//           QUERY: ${query}
          
//           ${combinedInput}
          
//           Generate a comprehensive answer based on all available information.
//           If the information is still incomplete, acknowledge the limitations.
          
//           Respond in the following JSON format:
//           {
//             "answer": "comprehensive answer",
//             "confidence": float from 0 to 1,
//             "requiresFollowUp": boolean,
//             "suggestedFollowUp": "suggested follow-up question if information is incomplete"
//           }
//         `
//       }
//     ];
    
//     // Call OpenAI with retry logic
//     const response = await retryAsyncOperation(
//       () => openai.chat.completions.create({
//         model: model,
//         messages: messages,
//         response_format: { type: "json_object" },
//         temperature: 0.1
//       }),
//       3, // Max 3 retries
//       1000 // Initial delay of 1 second
//     );
    
//     if (!response || !response.choices || !response.choices[0].message || !response.choices[0].message.content) {
//       logger.warn('Invalid response from OpenAI during context combination');
//       return {
//         answer: "I couldn't generate a comprehensive answer based on the available information.",
//         confidence: 0.1,
//         requiresFollowUp: true,
//         suggestedFollowUp: "Could you provide more specific information about what you're looking for?"
//       };
//     }
    
//     try {
//       const result = JSON.parse(response.choices[0].message.content);
      
//       // Validate and sanitize the response
//       return {
//         answer: result.answer || "I couldn't generate a comprehensive answer based on the available information.",
//         confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0.1,
//         requiresFollowUp: result.requiresFollowUp === false ? false : true,
//         suggestedFollowUp: result.sug