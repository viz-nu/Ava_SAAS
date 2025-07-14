// models/channel.js
import { Schema, model } from 'mongoose';

const baseOpts = { _id: false };      // subdocs don’t need their own _id
const docOpts = { timestamps: true, discriminatorKey: 'type' };

/* ───────────────────────────── Base Channel ───────────────────────────── */
const TemplateBaseSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "Users" },
        type: { type: String, enum: ['agent', 'action'], required: true },
        status: { type: String, default: 'disabled' },   // enabled | disabled | error
        avatar: String,
        isPublic: { type: Boolean, default: false },
        UIElements: Schema.Types.Mixed,
        isFeatured: { type: Boolean, default: false },
    },
    docOpts
);
export const Template = model('StandardProduct', TemplateBaseSchema, 'StandardProduct');

/* ───────────────────────────── Agent Template ──────────────────────────── */
const AgentConfig = new Schema(
    {
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
        business: [{ type: Schema.Types.ObjectId, ref: 'Businesses' }],
        analysisMetrics: Schema.Types.Mixed,
        facets: [String],
    },
    baseOpts
);
Template.discriminator('agent', new Schema({ config: AgentConfig, secrets: Schema.Types.Mixed }, docOpts));

/* ─────────────────────────── Action Template ─────────────────────────── */
const ActionConfig = new Schema(
    {
        name: String,
        business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
        async: { type: Boolean, default: true },
        name: String,
        description: String,
        needsApproval: Boolean, // Knowledge fetching doesn't need approval
        parameters: Schema.Types.Mixed,
        functionString: String,
        errorFunction: String,
        UI: Schema.Types.Mixed,
    },
    baseOpts
);
Template.discriminator('action', new Schema({ config: ActionConfig, secrets: Schema.Types.Mixed }, docOpts));