import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { EmbeddingFunct, getSummary } from "./openai.js";
import { Data } from "../models/Data.js";

export const digest = async (text, url, collectionId) => {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100
    });
    const chunks = await splitter.splitText(text);
    const batchSize = 10; // Send 10 requests at a time
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const responses = await Promise.all(
            batch.map(async (chunk, index) => {
                const summary = await getSummary(chunk)
                let embeddingVector = await EmbeddingFunct(summary)
                return { collection: collectionId, content: chunk, chunkNumber: i + index + 1, summary, embeddingVector: embeddingVector.data[0].embedding, metadata: { url: url } }
            }));
        await Data.insertMany(responses)
    }
}