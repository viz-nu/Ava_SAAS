import { model, Schema } from 'mongoose';

const MessagesSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: 'conversation' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    query: String,
    response: String,
    reaction: { type: String, default: "neutral", enum: ["neutral", "like", "dislike"] },
    embeddingTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    responseTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    context: Array,
    Actions: Array,
    actionTokens: Object,
    contextData:{ type: Schema.Types.Mixed }
}, {
    timestamps: true
});
export const Message = model('Message', MessagesSchema, "Messages");