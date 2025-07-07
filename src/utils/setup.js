import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from "langchain/text_splitter";
import { EmbeddingFunct, getSummary } from "./openai.js";
import { Data } from "../models/Data.js";
import { encoding_for_model } from "tiktoken";

export const digest = async (text, url, collectionId, extraMetaData = {}, topicsSoFar = [], contentType = "text") => {
    let splitter
    switch (contentType) {
        case "text":
            splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 100
            });
            break;
        case "markdown":
            splitter = new MarkdownTextSplitter({
                chunkSize: 1000, // Ideal chunk size
                chunkOverlap: 100, // To maintain context
            });
            break;
        default:
            return []
    }
    const chunks = await splitter.splitText(text)
    for (let i = 0; i < chunks.length; i++) {
        const { result, summary, newTopics, topics, tokenUsage } = await getSummary(chunks[i], topicsSoFar)
        if (result) {
            let { model, data, usage } = await EmbeddingFunct(summary)
            await Data.insertOne({
                collection: collectionId, content: chunks[i], chunkNumber: i + 1, summary, newTopics, embeddingVector: data[0].embedding, metadata: {
                    tokensUsed: usage.total_tokens, url: url, tokenUsage: {
                        embeddingTokens: usage.total_tokens,
                        embeddingModel: model,
                        summarizationInputTokens: tokenUsage.input,
                        summarizationOutputTokens: tokenUsage.output,
                        summarizationTotalTokens: tokenUsage.total,
                        summarizationModel: tokenUsage.model
                    }
                }
            })
            topicsSoFar = topics
        }
    }
    return topicsSoFar
}