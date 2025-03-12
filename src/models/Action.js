import { model, Schema } from 'mongoose';

const ActionSchema = new Schema({
    name: String,
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    intent: String,
    dataSchema: Object,
    accessType: { type: String, enum: ["Public", "Private"] },
    auth: { endpoint: String, dataSchema: Object },
    configData: { id: String, token: String },
    workingData: Object,
    UI: Object
}, {
    timestamps: true
});
export const Action = model('Action', ActionSchema, "Action");