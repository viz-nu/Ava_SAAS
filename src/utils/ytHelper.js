import { digest } from "./setup.js";
import { Collection } from "../models/Collection.js";
import { sendMessageToRoom } from "./socketIoClient.js";
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
export const processYT = async (collectionId, urls, receiver, _id) => {
    let total = urls.length, completed = 0, topics = []
    try {
        for (const { url, data } of urls) {
            const { text } = await YoutubeTranscript.fetchTranscript(url);
            try {
                topics = await digest(text, url, collectionId, {}, topics, "text");
                await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $push: { "contents.$.metaData.detailedReport": { success: true, url: url }, }, $addToSet: { topics: topics }, $set: { "contents.$.status": "active" } });
            } catch (error) {
                console.error("Error during digesting:", error);
                await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $push: { "contents.$.metaData.detailedReport": { success: false, url: url, error: error.message } }, $set: { "contents.$.status": "error" } });
            }
            completed += 1
            const progressData = { total, progress: completed, collectionId: collectionId }
            sendMessageToRoom(receiver.toString(), "adding-collection", progressData, "admin");
        }
        console.log("Finished processing YouTube videos")
        return { success: true }
    } catch (error) {
        console.error(error);

        return { success: false }
    }
}

