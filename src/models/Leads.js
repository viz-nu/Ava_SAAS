import { Schema, model } from 'mongoose';
const leadStatusEnum = ["new", "contacted", "qualified", "converted", "lost"];
/* ───────────────────────────── Lead ───────────────────────────── */
const LeadSchema = new Schema({
    template: { type: Schema.Types.ObjectId, ref: 'LeadTemplate', required: true },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: leadStatusEnum, default: 'new' },
    notes: { type: String, trim: true }
}, { timestamps: true });

/* ───────────────────────────── Lead Template ───────────────────────────── */
const leadTemplateFieldTypeEnum = ["string", "number", "email", "phone", "date", "boolean", "url", "text"];
const fieldSchema = new Schema({
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: leadTemplateFieldTypeEnum, required: true },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    validation: { minLength: Number, maxLength: Number, min: Number, max: Number, pattern: String },
    label: { type: String, required: true },
    placeholder: { type: String, trim: true },
    description: { type: String, trim: true }
}, { _id: false });

const LeadTemplateSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users', required: true },
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    fields: { type: [fieldSchema], required: true, validate: { validator: function (fields) { return fields && fields.length > 0; }, message: 'Template must have at least one field' } },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export const Lead = model('Lead', LeadSchema, 'Leads');
export const LeadTemplate = model('LeadTemplate', LeadTemplateSchema, 'LeadTemplates');