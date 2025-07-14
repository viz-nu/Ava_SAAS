import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
    name: String,
    data: { FileName: String, resource_id: String, mimetype: String, originalname: String, fileIdentifier: String, preview_url: String, download_url: String },
    contentType: String,
    user: { type: { type: Schema.Types.ObjectId, ref: "Users" }, default: "" },
    viewers: { type: [{ type: Schema.Types.ObjectId, ref: "Users" }], default: [] },
    type: String
}, { timestamps: true });
const Document = mongoose.model('document', documentSchema);
export default Document