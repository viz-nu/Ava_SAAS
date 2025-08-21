import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { digest } from "./setup.js";
import { Collection } from "../models/Collection.js";
import { io } from "./io.js";
export const processYT = async (collectionId, urls, receiver, _id) => {
    let total = urls.length, completed = 0, topics = []
    try {
        for (const { url, data } of urls) {
            const loader = YoutubeLoader.createFromUrl(url, { language: data.lang || "en", addVideoInfo: true, });
            const docs = await loader.load();
            let text = docs.map(ele => ele.pageContent).join('');
            topics = await digest(text, url, collectionId, {}, topics, "text");
            await Collection.updateOne(
                { _id: collectionId, "contents._id": _id },
                {
                    $push: {
                        "contents.$.metaData.detailedReport": {
                            success: true,
                            url: url
                        },
                    },
                    $addToSet: { topics: topics }
                }
            );
            completed += 1
            const progressData = { total, progress: completed, collectionId: collectionId }
            adminNamespace.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: progressData });
        }
        console.log("Finished processing YouTube videos")
        return { success: true }
    } catch (error) {
        console.error(error);
        return { success: false }
    }
}


