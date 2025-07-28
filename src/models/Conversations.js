import { model, Schema } from 'mongoose';
const ConversationStatusEnum = ["initiated", "active", "interrupted", "inactive", "disconnected"];
const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    channel: String,
    telegramChatId: String,
    whatsappChatId: String,
    contact: Schema.Types.Mixed,
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    status: { type: String, enum: ConversationStatusEnum, default: "initiated" },
    sockets: {
        socketId: String,
        disconnectReason: String,
    },
    /** Conversation state & runtime extras */
    session: Schema.Types.Mixed,
    state: String,
    pendingInterruptions: [{ type: Schema.Types.Mixed }],
    /** ---------------- Analytics buckets ---------------- */
    geoLocation: Schema.Types.Mixed,
    analysisMetrics: Schema.Types.Mixed,
    metadata: { totalMessages: Number, reactions: { neutral: Number, like: Number, dislike: Number } }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");