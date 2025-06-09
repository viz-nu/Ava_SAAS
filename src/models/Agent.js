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
        model: { type: String, default: 'gpt-4.1-mini' },
        temperature: { type: Number, default: 0.5 },
        assistantId: String,
        noDataMail: { type: String, default: "vishnu@campusroot.com" },
    },
    integrations: {
        telegram: {
            botToken: String,
            webhookUrl: String,
            id: String,
            userName: String
        },
        whatsapp: {
            webhookUrl: String,
            verificationToken: String,
            permanentAccessToken: String,
            updatedAt: Date
        }
    },
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
}, {
    timestamps: true
});
import { randomBytes } from 'crypto';
AgentSchema.pre('save', function (next) {
    // if (!this.integrations.whatsapp || !this.integrations.whatsapp.verificationToken) this.integrations.whatsapp = { webhookUrl: `https://chatapi.campusroot.com/webhook/whatsapp/${this._id}`, verificationToken: randomBytes(9).toString('hex') };
    if (!this.integrations.whatsapp || !this.integrations.whatsapp.verificationToken) this.integrations.whatsapp = { webhookUrl: `${process.env.SERVER_URL}webhook/whatsapp/${this._id}`, verificationToken: randomBytes(9).toString('hex') };
    next();
});
export const AgentModel = model('Agent', AgentSchema, "Agent");