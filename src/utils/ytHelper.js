import { YoutubeTranscript } from "youtube-transcript"
import { digest } from "./setup.js";

export const processYT = async (collectionId, urls) => {
    try {
        for (const { url, lang = "en" } of urls) {
            let resp
            try {
                resp = await YoutubeTranscript.fetchTranscript(url, { lang })
            } catch (error) {
                const errorJson = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                // Extract the available language from the error message
                const match = errorJson.message.match(/Available languages: (.+)/);
                if (match) {
                    const availableLang = match[1].trim(); // Extracted language
                    console.log(`Retrying with available language: ${availableLang}`);
                    // Retry with the available language
                    try {
                        resp = await YoutubeTranscript.fetchTranscript(url, { lang: availableLang });
                    } catch (retryError) {
                        console.error("Retry failed:", retryError);
                    }
                } else {
                    console.error("No available languages found. Full error:", errorJson);
                }
            }
            let text = resp.map(ele => ele.text).join('');
            await digest(text, url, collectionId)
        }
        console.log("Finished processing YouTube videos")
        return { success: true }
    } catch (error) {
        console.log(error);
        return { success: false, error: error.message || error}
    }

}


