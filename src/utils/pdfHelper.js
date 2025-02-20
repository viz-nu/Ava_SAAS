import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { digest } from "./setup.js";

const downloadFile = async (url) => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const response = await fetch(url);
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type');
    const ext = contentType ? contentType.split('/')[1] : 'bin'; // Default to 'bin' if no content-type is found

    // const finalPath = filePath.endsWith(`.${ext}`) ? filePath : `${filePath}.${ext}`;
    const tempFilePath = path.join(__dirname, `${new Date().toISOString()}.${ext}`);
    fs.writeFileSync(tempFilePath, buffer);
    return { tempFilePath, ext };
};

export const fileProcessor = async (collectionId, url) => {
    try {
        let { tempFilePath, ext } = await downloadFile(url);
        if (!tempFilePath) throw new Error("Failed to download file");
        switch (ext) {
            case "pdf":
                const loader = new PDFLoader(tempFilePath);
                const docs = await loader.load();
                for await (const doc of docs) await digest(doc.pageContent, url, collectionId)
                break;
        
            default:
                break;
        }
        fs.unlinkSync(tempFilePath);
        return { success: true }
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message || error }
    }
}

