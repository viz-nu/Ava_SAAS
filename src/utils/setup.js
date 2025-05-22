import { RecursiveCharacterTextSplitter, MarkdownTextSplitter } from "langchain/text_splitter";
import { EmbeddingFunct, getSummary } from "./openai.js";
import { Data } from "../models/Data.js";
import { encoding_for_model } from "tiktoken";

export const digest = async (text, url, collectionId) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100
    });
    const chunks = await splitter.splitText(text)
    const batchSize = 10; // Send 10 requests at a time
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const responses = await Promise.all(
            batch.map(async (chunk, index) => {
                const enc = encoding_for_model("text-embedding-3-small");
                const tokens = enc.encode(chunk);
                const tokensUsed = tokens.length;
                const { content, result } = await getSummary(chunk)
                if (!result) {
                    return { collection: collectionId, content: chunk, chunkNumber: i + index + 1, summary: content, embeddingVector: [], metadata: { tokensUsed, url: url } }

                }
                let embeddingVector = await EmbeddingFunct(content)
                return { collection: collectionId, content: chunk, chunkNumber: i + index + 1, summary: content, embeddingVector: embeddingVector.data[0].embedding, metadata: { tokensUsed, url: url } }

            }));
        await Data.insertMany(responses)
    }
}
export const digestMarkdown = async (text, url, collectionId, extraMetaData = {}) => {
    const markdownSplitter = new MarkdownTextSplitter({
        chunkSize: 1000, // Ideal chunk size
        chunkOverlap: 100, // To maintain context
    });
    const chunks = await markdownSplitter.splitText(text)
    const batchSize = 10; // Send 10 requests at a time
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const responses = await Promise.all(
            batch.map(async (chunk, index) => {
                const enc = encoding_for_model("text-embedding-3-small");
                const tokens = enc.encode(text);
                const tokensUsed = tokens.length;
                const { content, result } = await getSummary(chunk)
                if (!result) return { collection: collectionId, content: chunk, chunkNumber: i + index + 1, summary: content, embeddingVector: [], metadata: { tokensUsed, url: url, ...extraMetaData } }
                let embeddingVector = await EmbeddingFunct(content)
                return { collection: collectionId, content: chunk, chunkNumber: i + index + 1, summary: content, embeddingVector: embeddingVector.data[0].embedding, metadata: { tokensUsed, url: url, ...extraMetaData } }
            }));
        await Data.insertMany(responses)
    }
}