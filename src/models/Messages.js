import { model, Schema } from 'mongoose';

const MessagesSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: 'conversation' },
    query: String,
    response: String,
    embeddingTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    responseTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    context: Array
}, {
    timestamps: true
});
export const Message = model('Message', MessagesSchema, "Messages");