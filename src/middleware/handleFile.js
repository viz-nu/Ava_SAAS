import multer, { diskStorage } from "multer";
import path from "path";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
const storage = diskStorage({
    destination: "./public/data/uploads/",
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + uuidv4() + path.extname(file.originalname));
    }
});
const fileFilter = (req, file, cb) => {
    const validFiles = ["application/pdf", "text/plain"];
    if (validFiles.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("File should be txt or pdf"), false);
};
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1000 * 1000 },
}).array("uploaded_files", 10); // Accept up to 10 files



const uploadAsync = promisify(upload);
export const handleFiles = async (req, res, next) => {
    try {
        await uploadAsync(req, res);
        if (!req.files || req.files.length === 0) {
            return res.status(401).json({ success: false, message: "No files were uploaded", data: null });
        }
        next();
    } catch (err) {
        console.error(err);
        return res.status(401).json({ success: false, message: err instanceof multer.MulterError ? err.message : "Please make sure the files are in TXT or PDF format", data: null });
    }
};