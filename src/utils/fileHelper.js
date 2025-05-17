import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { digest } from "./setup.js";
import { URL } from "url";
import officeParser from "officeparser";
import { Collection } from "../models/Collection.js";
import { io } from "./io.js";
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
// const downloadFile = async (url) => {
//     const __dirname = path.dirname(new URL(import.meta.url).pathname);
//     const response = await fetch(url);
//     const buffer = await response.buffer();
//     const contentType = response.headers.get('content-type');
//     const ext = mimeToExt[contentType] || "bin"; // Default to 'bin' if unknown
//     let fileType = contentType.split('/')[0]
//     const tempFilePath = path.resolve(process.cwd(), `public/data/uploads/${new Date().toISOString()}.${ext}`);
//     fs.writeFileSync(tempFilePath, buffer);
//     return { tempFilePath, fileType, ext };
// };
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isAbsoluteUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};
const downloadFile = async (url) => {
    try {
        if (!isAbsoluteUrl(url)) {
            throw new Error(`Invalid URL: ${url}. Only absolute URLs are supported.`);
        }
        console.log(url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const ext = mimeToExt[contentType] || mime.extension(contentType) || "bin";
        const fileType = contentType.split("/")[0];

        const uploadDir = path.resolve(process.cwd(), "public/data/uploads");
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const tempFilePath = path.join(uploadDir, `${timestamp}.${ext}`);

        fs.writeFileSync(tempFilePath, Buffer.from(buffer));

        return { tempFilePath, fileType, ext };
    } catch (error) {
        console.error("Error downloading file:", error.message);
        throw error;
    }
};
export const processFile = async (collectionId, url, receivers = [], _id) => {
    try {
        let { tempFilePath, fileType, ext } = await downloadFile(url);
        if (!tempFilePath) throw new Error("Failed to download file");
        let content
        switch (ext) {
            case "pdf":
                const loader = new PDFLoader(tempFilePath);
                const docs = await loader.load();
                content = docs.map(doc => doc.pageContent).join("\n");
                // for await (const doc of docs) await digest(doc.pageContent, url, collectionId)
                break;
            case "txt":
            case "json":
                content = fs.readFileSync(tempFilePath, "utf-8");
                break;
            case "docx":
            case "xlsx":
            case "pptx":
                content = await officeParser.parse(tempFilePath);
                break;
            // more document itegrations 
            // https://js.langchain.com/docs/integrations/document_loaders/file_loaders/


            default:
                throw new Error("unsupported file type");
            // break;
        }
        await digest(content, url, collectionId);
        await Collection.updateOne(
            { _id: collectionId, "contents._id": _id },
            {
                $push: {
                    "contents.$.metaData.detailedReport": {
                        success: true,
                        url: url
                    },
                },
                $set: {
                    "contents.$.status": "active"
                }

            }
        );
        fs.unlinkSync(tempFilePath);
        receivers.forEach(receiver => io.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: { total: 1, progress: 1, collectionId: collectionId } }));
        return { success: true, data: null }
    } catch (error) {
        console.error(error);
        await Collection.updateOne(
            { _id: collectionId, "contents._id": _id },
            {
                $push: {
                    "contents.$.metaData.detailedReport": {
                        success: false,
                        url: url
                    },
                },
                $set: {
                    "contents.$.status": "active"
                }
            }
        );
        return { success: false, error: error.message || error, data: null }
    }
}

