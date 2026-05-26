import { model, Schema } from 'mongoose';

const DemonstrationSchema = new Schema({
    lead: {
        name: String,
        email: String,
        phone: String,
        department: String,
        source: String,
    },
    organization: {
        id: String,
        name: String,
        industry: String,
    },
    transcripts: Schema.Types.Mixed,
    miscellaneous: Schema.Types.Mixed,
    kind: String,
    demoEndedAt: Date,
}, { timestamps: true });

export const DemonstrationModel = model('Demonstrations', DemonstrationSchema, "Demonstrations");