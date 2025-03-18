import { model, Schema } from 'mongoose';

const AgentSchema = new Schema({
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    appearance: {
        clientMessageBox: { backgroundColor: String, textColor: String },
        avaMessageBox: { backgroundColor: String, textColor: String },
        textInputBox: { backgroundColor: String, textColor: String },
        quickQuestionsWelcomeScreenBox: { backgroundColor: String, textColor: String }
    },
    personalInfo: {
        name: String,
        role: String,
        systemPrompt: String,
        facts: [String],
        quickQuestions: [{ label: String, value: String }],
        welcomeMessage: String,
        model: { type: String, default: "gpt-4o-mini" },
        temperature: { type: Number, default: 1 },
        assistantId: String
    },
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
}, {
    timestamps: true
});
export const Agent = model('Agent', AgentSchema, "Agent");