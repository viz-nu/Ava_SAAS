import { model, Schema } from 'mongoose';

const AgentSchema = new Schema({
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    appearance: { type: Schema.Types.Mixed },
    personalInfo: { type: Schema.Types.Mixed },
    actions: [{ type: Schema.Types.Mixed }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
}, {
    timestamps: true
});
export const Agent = model('Agent', AgentSchema, "Agent");