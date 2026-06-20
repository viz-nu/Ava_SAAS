import { Schema, model } from 'mongoose';
const leadStatusEnum = ["new", "contacted", "qualified", "converted", "lost"];
const platformEntrySchema = new Schema({
    platform: { type: String, required: true },   // Phone,'Twitter', 'Instagram', 'Whatsapp', etc.
    handle: { type: String, trim: true },
    label: { type: String, trim: true },        // 'work', 'personal', 'brand'
    isPrimary: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} }
}, { _id: false });
const contactDetailsSchema = new Schema({
    whatsapp: [platformEntrySchema],
    telegram: [platformEntrySchema],
    email: [platformEntrySchema],   // multiple emails (work, personal)
    phone: [platformEntrySchema],
    twitter: [platformEntrySchema],
    instagram: [platformEntrySchema],
    facebook: [platformEntrySchema],
    // tiktok: [platformEntrySchema],
    // youtube: [platformEntrySchema],
    // snapchat: [platformEntrySchema],
    // pinterest: [platformEntrySchema],
    // reddit: [platformEntrySchema],
    // threads: [platformEntrySchema],
    // bluesky: [platformEntrySchema],
    // signal: [platformEntrySchema],
    // wechat: [platformEntrySchema],
    // line: [platformEntrySchema],
    // viber: [platformEntrySchema],
    // discord: [platformEntrySchema],
    // slack: [platformEntrySchema],
    // linkedin: [platformEntrySchema],
    // github: [platformEntrySchema],
    // behance: [platformEntrySchema],
    // dribbble: [platformEntrySchema],
    // medium: [platformEntrySchema],
    // substack: [platformEntrySchema],
    // producthunt: [platformEntrySchema]
}, { _id: false });
/* ───────────────────────────── Lead ───────────────────────────── */
const LeadSchema = new Schema({
    template: { type: Schema.Types.ObjectId, ref: 'LeadTemplate' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    //identity   
    name: { type: String, trim: true },
    contactDetails: { type: contactDetailsSchema, default: () => ({}) },
    source: String, // Whatsapp-Inbound
    tags: [String],
    //evaluation
    leadScore: { type: Number, default: 0 },
    status: { type: String, enum: leadStatusEnum, default: 'new' },
    notes: { type: String, trim: true },
    // operations
    lastInteractedAt: Date,
    nextFollowUpAt: Date,
    pendingTasks: Schema.Types.Mixed,
    data: { type: Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });

/* ───────────────────────────── Lead Template ───────────────────────────── */
// const leadTemplateFieldTypeEnum = ["string", "number", "email", "phone", "date", "boolean", "url", "text"];
// const fieldSchema = new Schema({
//     name: { type: String, required: true, trim: true },
//     type: { type: String, enum: leadTemplateFieldTypeEnum, required: true },
//     required: { type: Boolean, default: false },
//     defaultValue: { type: Schema.Types.Mixed, default: null },
//     validation: { minLength: Number, maxLength: Number, min: Number, max: Number, pattern: String },
//     label: { type: String, required: true },
//     placeholder: { type: String, trim: true },
//     description: { type: String, trim: true }
// }, { _id: false });

const LeadTemplateSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    fields: Schema.Types.Mixed,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Lead = model('Lead', LeadSchema, 'Leads');
export const LeadTemplate = model('LeadTemplate', LeadTemplateSchema, 'LeadTemplates');