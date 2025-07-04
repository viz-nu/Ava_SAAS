import { model, Schema } from 'mongoose';

const AgentSchema = new Schema({
    appearance: {
        clientMessageBox: { backgroundColor: String, textColor: String },
        avaMessageBox: { backgroundColor: String, textColor: String },
        textInputBox: { backgroundColor: String, textColor: String },
        quickQuestionsWelcomeScreenBox: { backgroundColor: String, textColor: String }
    },
    interactionMetrics: Array,
    tools: [{
        async: { type: Boolean, default: true },
        name: String,
        description: String,
        needsApproval: { type: Boolean, default: false },
        parameters: Schema.Types.Mixed,
        functionString: String,
        errorFunction: String
    }],
    personalInfo: {
        name: String,
        systemPrompt: String,
        quickQuestions: [{ label: String, value: String }],
        welcomeMessage: String,
        model: { type: String, default: 'gpt-4.1-mini' },
        temperature: { type: Number, default: 0.5 },
    },
    integrations: {
        telegram: {
            botToken: String,
            webhookUrl: String,
            id: String,
            userName: String
        },
        whatsapp: {
            phone_number_id: String,
            waba_id: String,
            phoneNumberPin: String,
            business_id: String,
            status: String,
            webhookUrl: String,
            verificationToken: String,
            permanentAccessToken: String,
            updatedAt: Date
        }
    },
    channels:[{ type: Schema.Types.ObjectId, ref: 'Channel' }],
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
}, {
    timestamps: true
});
export const AgentModel = model('Agent', AgentSchema, "Agent");