import { YoutubeLoader } from "@langchain/community/document_loaders/web/youtube";
import { digest } from "./setup.js";
import { writeFileSync } from "fs"
export const processYT = async (collectionId, urls) => {
    let result = [];
    try {
        for (const { url, data } of urls) {
            const loader = YoutubeLoader.createFromUrl(url, { language: data.lang || "en", addVideoInfo: true, });
            const docs = await loader.load();
            let text = docs.map(ele => ele.pageContent).join('');
            await digest(text, url, collectionId)
            result.push({ url, success: true })
        }
        console.log("Finished processing YouTube videos")
        return { success: true, data: result }
    } catch (error) {
        console.log(error);
        return { success: false, error: error.message || error, data: result }
    }
}


