import { model, Schema } from 'mongoose';

const AgentSchema = new Schema({
    appearance: {
        clientMessageBox: { backgroundColor: String, textColor: String },
        avaMessageBox: { backgroundColor: String, textColor: String },
        textInputBox: { backgroundColor: String, textColor: String },
        quickQuestionsWelcomeScreenBox: { backgroundColor: String, textColor: String }
    },
    interactionMetrics: Array,
    personalInfo: {
        name: String,
        systemPrompt: String,
        quickQuestions: [{ label: String, value: String }],
        welcomeMessage: String,
        model: { type: String, default: 'gpt-4.1-mini' },
        temperature: { type: Number, default: 0.5 },
    },
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    channels: [{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    analysisMetrics: Schema.Types.Mixed,
    facets: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
}, {
    timestamps: true
});
export const AgentModel = model('Agent', AgentSchema, "Agent");