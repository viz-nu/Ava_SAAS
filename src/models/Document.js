import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
    name: { type: String },
    data: { FileName: { type: String }, resource_id: { type: String }, mimetype: { type: String }, originalname: { type: String }, fileIdentifier: { type: String }, preview_url: { type: String },download_url: { type: String }},
    contentType: { type: String },
    user: { type: mongoose.Types.ObjectId, ref: "user" },
    viewers: [{ type: mongoose.Types.ObjectId, ref: "user" }],
    type: { type: String }
}, { timestamps: true });
const Document = mongoose.model('document', documentSchema);
export default Document