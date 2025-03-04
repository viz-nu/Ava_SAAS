import { model, Schema } from 'mongoose';

const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    analysis: { type: Schema.Types.Mixed },
    geoLocation: { type: Schema.Types.Mixed }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");