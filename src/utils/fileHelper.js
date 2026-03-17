import { Collection } from "../models/Collection.js";
import { sendMessageToRoom } from "./socketIoClient.js";
import { llamaParser } from "../services/llamaparse.js";
export const processFile = async (collectionId, metaData, receiver, _id) => {
    let parsing = null;
    try {
        parsing = await llamaParser.parse(metaData.parserDetails, { content_id: _id, collection_id: collectionId, business_id: receiver.toString()});
        await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $push: { "contents.$.parserDetails.lastUpdate": parsing } });
        sendMessageToRoom(receiver.toString(), "adding-collection", { total: 1, progress: 0.3, collectionId: collectionId }, "admin");
        return { success: true, data: null }
    } catch (error) {
        console.error(error);
        await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $push: { "contents.$.parserDetails.lastUpdate": parsing }, $set: { "contents.$.status": "failed" } });
        return { success: false, error: error.message || error, data: null }
    }
}

