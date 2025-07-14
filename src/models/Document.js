import { Schema,model } from "mongoose";


const documentSchema = Schema({
    name: String,
    data: { FileName: String, resource_id: String, mimetype: String, originalname: String, fileIdentifier: String, preview_url: String, download_url: String },
    contentType: String,
    user: { type: Schema.Types.ObjectId, ref: "Users" },
    viewers: [{ type: Schema.Types.ObjectId, ref: "Users" }],
    type: String
}, { timestamps: true });
const Document = model('document', documentSchema);
export default Document