import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { digest } from "./setup.js";

const mimeToExt = {
    // Documents & Text Files
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/csv": "csv",

    // Structured & Data Files
    "application/json": "json",
    "application/xml": "xml",
    "text/yaml": "yaml",
    "application/x-yaml": "yml",
    "application/x-sql": "sql",
    "application/vnd.sqlite3": "sqlite",

    // Compressed & Archive Files
    "application/zip": "zip",
    "application/x-tar": "tar",
    "application/gzip": "gz",
    "application/x-7z-compressed": "7z",
    "application/x-rar-compressed": "rar",

    // Images & Graphics
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/gif": "gif",
    "image/webp": "webp",

    // Multimedia Files
    "audio/mpeg": "mp3",
    "video/mp4": "mp4",
    "audio/wav": "wav",
    "video/webm": "webm"
};
const downloadFile = async (url) => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const response = await fetch(url);
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type');
    const ext = mimeToExt[contentType] || "bin"; // Default to 'bin' if unknown
    let fileType = contentType.split('/')[0]
    const tempFilePath = path.join(__dirname, `${new Date().toISOString()}.${ext}`);
    fs.writeFileSync(tempFilePath, buffer);
    return { tempFilePath, fileType, ext };
};

export const processFile = async (collectionId, url) => {
    let result = [];
    try {
        let { tempFilePath, ext } = await downloadFile(url);
        if (!tempFilePath) throw new Error("Failed to download file");
        switch (ext) {
            case "pdf":
                const loader = new PDFLoader(tempFilePath);
                const docs = await loader.load();
                for await (const doc of docs) await digest(doc.pageContent, url, collectionId)
                break;
            case "txt":
                // For .txt files, just read the content directly
                const txtContent = fs.readFileSync(filePath, 'utf-8');
                await digest(txtContent, url, collectionId);
                break;
            case "json":
                // For JSON files, parse the content and handle it
                const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                await digest(JSON.stringify(jsonContent, null, 2), url, collectionId);
                break;


                // more document itegrations 
                // https://js.langchain.com/docs/integrations/document_loaders/file_loaders/


                
            default:
                throw new Error("unsupported file type");
            // break;
        }
        result.push({ url, success: true })
        fs.unlinkSync(tempFilePath);
        return { success: true, data: result }
    } catch (error) {
        console.error(error);
        return { success: false, error: error.message || error, data: result }
    }
}

