import { model, Schema } from 'mongoose';

const BusinessSchema = new Schema({
    name: String,
    logoURL: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    docData: { type: Schema.Types.Mixed },
    members: [{ type: Schema.Types.ObjectId, ref: 'Users' }],
    agents: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    documents: [{ type: Schema.Types.ObjectId, ref: "document" }]
}, {
    timestamps: true
});
export const Business = model('Businesses', BusinessSchema, "Businesses");