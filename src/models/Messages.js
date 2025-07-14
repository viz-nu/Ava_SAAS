import { model, Schema } from 'mongoose';

const MessagesSchema = new Schema({
    conversationId: { type: { type: Schema.Types.ObjectId, ref: 'conversation' }, default: "" },
    business: { type: { type: Schema.Types.ObjectId, ref: 'Businesses' }, default: "" },
    query: String,
    response: String,
    reaction: { type: String, default: "neutral", enum: ["neutral", "like", "dislike"] },
    analysisTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    embeddingTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    responseTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    triggeredActions: Array,
    context: Array,
    Actions: Array,
    analysis: Array,
    actionTokens: Object,
}, {
    timestamps: true
});
export const Message = model('Message', MessagesSchema, "Messages");