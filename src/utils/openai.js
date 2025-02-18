import { MongoClient } from "mongodb"
import OpenAI from "openai";
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
        console.log(error);
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
        console.log(error);
        return null;
    }
}