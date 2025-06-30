import { model, Schema } from 'mongoose';
const ChannelSchema = new Schema({
    name: String,
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    type: { type: String, enum: ["telegram", "whatsapp", "web", "phone", "instagram", "sms", "email"], required: true },
    config: Schema.Types.Mixed,
    secrets: Schema.Types.Mixed,
    status: { type: String },
    webhookUrl: String,
    systemPrompt: String,
    isPublic: { type: Boolean, default: false },
    UIElements: Schema.Types.Mixed
}, {
    timestamps: true
});
export const Channel = model('Channel', ChannelSchema, "Channel");