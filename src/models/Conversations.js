import { model, Schema } from 'mongoose';

const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    telegramChatId: String,
    whatsappChatId: String,
    contact: Object,
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    analysis: { type: Schema.Types.Mixed },
    session: Object,
    state: String,
    pendingInterruptions: Array,//[{ id: String, type: String, functionCall: Object, timestamp: { type: Date, default: Date.now }, status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' } }],
    metadata: { agentName: String, model: String, totalMessages: Number, lastActivity: { type: Date, default: Date.now } },
    geoLocation: { type: Schema.Types.Mixed }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");