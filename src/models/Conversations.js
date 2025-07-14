import { model, Schema } from 'mongoose';
const ConversationStatusEnum = ["initiated", "active", "interrupted", "inactive"]
const ConversationSchema = new Schema({
    business: { type: { type: Schema.Types.ObjectId, ref: 'Businesses' }, default: "" },
    channel: String,
    telegramChatId: String,
    whatsappChatId: String,
    contact: Schema.Types.Mixed,
    agent: { type: { type: Schema.Types.ObjectId, ref: 'Agent' }, default: "" },
    status: { type: String, enum: ConversationStatusEnum, default: "initiated" },
    /** Conversation state & runtime extras */
    session: Schema.Types.Mixed,
    state: String,
    pendingInterruptions: [{
        id: String,
        type: String,
        functionCall: Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
    }],
    /** ---------------- Analytics buckets ---------------- */
    geoLocation: Schema.Types.Mixed,
    analysisMetrics: Schema.Types.Mixed,
    metadata: { totalMessages: Number, reactions: { neutral: Number, like: Number, dislike: Number } }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");