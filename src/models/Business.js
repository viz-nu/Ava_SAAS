import { model, Schema } from 'mongoose';

const BusinessSchema = new Schema({
    name: String,
    logoURL: String,
    facts: [String],
    quickQuestions: [{ label: String, value: String }],
    sector: String,
    tagline: String,
    address: String,
    description: String,
    contact: {
        mail: String,
        phone: String,
        website: String
    },
    // modelIntegrations: { OpenAi: { apiKey: String, name: String, id: String, redacted_value: String, created_at: Date } },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    docData: { type: Schema.Types.Mixed },
    members: [{ type: Schema.Types.ObjectId, ref: 'Users' }],
    agents: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    documents: [{ type: Schema.Types.ObjectId, ref: "document" }]
}, {
    timestamps: true
});
export const Business = model('Businesses', BusinessSchema, "Businesses");