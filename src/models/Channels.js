import { Schema, model } from 'mongoose';
const ChannelBaseSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
        provider: { type: Schema.Types.ObjectId, ref: 'Providers' },
        apiAuthenticator: { type: Schema.Types.ObjectId, ref: 'ApiAuthenticators' },
        type: { type: String, enum: ["whatsapp", "telegram", "web", "phone", "instagram", "sms", "email"] },
        config: { type: Schema.Types.Mixed, default: {} },
        status: { type: String, default: 'disabled' },   // enabled | disabled | error
        webhookUrl: String,
        systemPrompt: String,
        isPublic: { type: Boolean, default: false },
        UIElements: Schema.Types.Mixed,
        // defaultTemplate for leades created using this channel
        // snoozTime: Date,
        // Notification:Schema.Types.Mixed,
        // iceBreaker: template
    },
    { timestamps: true }
);
ChannelBaseSchema.methods.updateStatus = function (status) {
    this.status = status;
    return this.save();
};
export const Channel = model('Channel', ChannelBaseSchema, 'Channel');