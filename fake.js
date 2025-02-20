import fs from 'fs';
import path from 'path';
import { PDFLoader } from 'your-pdf-loader-library'; // Adjust with actual PDF loader
import { digest } from 'your-digest-function'; // Replace with actual digest function
import { TurndownService } from 'turndown'; // Markdown converter
import { JSDOM } from 'jsdom'; // For HTML parsing

// Function to extract text content from PDFs and other files
const extractContent = async (ext, filePath, url, collectionId) => {
    switch (ext) {
        case "pdf":
            // For PDF files, use the PDFLoader
            const loader = new PDFLoader(filePath);
            const docs = await loader.load();
            for await (const doc of docs) {
                await digest(doc.pageContent, url, collectionId);
            }
            break;

        case "txt":
            // For .txt files, just read the content directly
            const txtContent = fs.readFileSync(filePath, 'utf-8');
            await digest(txtContent, url, collectionId);
            break;

        case "html":
            // For .html files, parse the HTML to text
            const htmlContent = fs.readFileSync(filePath, 'utf-8');
            const { document } = (new JSDOM(htmlContent)).window;
            const textContent = document.body.textContent || document.body.innerText;
            await digest(textContent, url, collectionId);
            break;

        case "md":
            // For markdown files, read the content directly
            const mdContent = fs.readFileSync(filePath, 'utf-8');
            await digest(mdContent, url, collectionId);
            break;

        case "json":
            // For JSON files, parse the content and handle it
            const jsonContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            await digest(JSON.stringify(jsonContent, null, 2), url, collectionId);
            break;

        default:
            // For other file types, just read and send the raw content
            const rawContent = fs.readFileSync(filePath, 'utf-8');
            await digest(rawContent, url, collectionId);
            break;
    }
};

export const FileProcessor = async (collectionId, url) => {
    try {
        const tempFilePath = await downloadFile(url); // Download file and get the path
        const ext = path.extname(tempFilePath).slice(1); // Extract file extension (remove the leading dot)

        // Extract content based on the file type
        await extractContent(ext, tempFilePath, url, collectionId);

        // Clean up the temporary file after processing
        fs.unlinkSync(tempFilePath);

        return { success: true };
    } catch (error) {
        console.error('Error processing file:', error);
        return { success: false, error: error.message || error };
    }
};
