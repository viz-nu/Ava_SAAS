import { model, Schema } from 'mongoose';

const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    telegramChatId: String,
    whatsappChatId: String,
    contact: Object,
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    analysis: { type: Schema.Types.Mixed },
    session: Object,
    geoLocation: { type: Schema.Types.Mixed }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");