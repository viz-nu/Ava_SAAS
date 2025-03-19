import { model, Schema } from 'mongoose';

const ActionSchema = new Schema({
    name: String,
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    intent: String,
    intentType: { type: String, enum: ["Query", "Response", "Conversation"] },
    // dataSchema: Object,
    accessType: { type: String, enum: ["Public", "Private"] },
    configData: { id: String, token: String, timeout: Number, retries: Number, retryDelay: Number },
    workingData: { headers: Object, body: Object, url: Object, auth: Object, method: { type: String, enum: ["POST", "GET", "PUT", "DELETE", "PATCH"] } },
    UI: Object
}, {
    timestamps: true
});
export const Action = model('Action', ActionSchema, "Action");