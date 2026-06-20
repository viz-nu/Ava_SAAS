import { model, Schema } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────

const BILLING_CATEGORY = [
    // AI
    "ai.conversation",        // agent replying to a lead
    "ai.analysis",            // post-conversation analysis
    "ai.summarization",       // conversation summarization
    "ai.transcription",       // voice/audio → text (Whisper)
    "ai.embedding",           // vector embeddings
    // Messaging
    "messaging.outbound",     // outbound message sent via WhatsApp/Telegram/SMS
    "messaging.inbound",      // inbound (if your provider charges per inbound)
    "messaging.template",     // WhatsApp template message (meta charges separately)
    // Workflow
    "workflow.execution",     // workflow triggered and ran
    "workflow.step",          // individual step within a workflow
    // Platform
    "platform.api_call",      // external API call made on behalf of business
    "platform.storage",       // file/media storage
    "platform.export",        // data export
];

const BILLING_STATUS = ["success", "failed", "refunded", "pending"];

const CHANNEL_TYPE = ["Whatsapp", "Telegram", "SMS", "Email", "Web", "Phone"];

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

// AI-specific usage — only populated for ai.* categories
const aiUsageSchema = new Schema({
    model:          { type: String },                    // "gpt-4o-mini", "whisper-1"
    inputTokens:    { type: Number, default: 0 },
    cachedTokens:   { type: Number, default: 0 },        // prompt cache hits (cheaper)
    outputTokens:   { type: Number, default: 0 },
    totalTokens:    { type: Number, default: 0 },
    turns:          { type: Number, default: 1 },        // how many agent turns ran
    toolCallCount:  { type: Number, default: 0 },        // number of tool calls made
}, { _id: false });

// Messaging-specific — only for messaging.* categories
const messagingUsageSchema = new Schema({
    channel:        { type: String, enum: CHANNEL_TYPE },
    provider:       { type: String },                    // "meta", "twilio", "vonage"
    messageType:    { type: String },                    // "text", "template", "media"
    segmentCount:   { type: Number, default: 1 },        // SMS segments
    templateName:   { type: String },                    // WhatsApp template name
    direction:      { type: String, enum: ["inbound", "outbound"] },
}, { _id: false });

// Workflow-specific
const workflowUsageSchema = new Schema({
    stepsExecuted:  { type: Number, default: 0 },
    stepsFailed:    { type: Number, default: 0 },
    durationMs:     { type: Number },                    // total execution time
}, { _id: false });

// Cost breakdown — always populated
const costSchema = new Schema({
    // Raw provider cost
    providerCostUsd:    { type: Number, default: 0 },   // what YOU pay provider
    // What you charge the business
    creditRate:         { type: Number },               // your spendRatio at time of billing
    creditsCharged:     { type: Number, default: 0 },   // credits deducted from business
    // For reconciliation
    currency:           { type: String, default: "USD" },
}, { _id: false });

// References — what triggered this log entry
const sourceSchema = new Schema({
    conversation:   { type: Schema.Types.ObjectId, ref: "Conversation" },
    message:        { type: Schema.Types.ObjectId, ref: "Message" },
    campaign:       { type: Schema.Types.ObjectId, ref: "Campaign" },
    workflow:       { type: Schema.Types.ObjectId, ref: "Workflow" },
    channel:        { type: Schema.Types.ObjectId, ref: "Channel" },
    agent:          { type: Schema.Types.ObjectId, ref: "Agent" },
    lead:           { type: Schema.Types.ObjectId, ref: "Lead" },
    // The external ID from the provider (wamid, etc.)
    externalId:     { type: String },
}, { _id: false });

// ─── Main Schema ──────────────────────────────────────────────────────────────

const BillingLogSchema = new Schema({
    // ── Who ───────────────────────────────────────────────────────────
    business:       { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },

    // ── What ──────────────────────────────────────────────────────────
    category:       { type: String, enum: BILLING_CATEGORY, required: true },
    status:         { type: String, enum: BILLING_STATUS, default: "success" },

    // ── Why / Where ───────────────────────────────────────────────────
    source:         { type: sourceSchema, default: () => ({}) },

    // ── Usage detail (only relevant sub-schema will be populated) ─────
    ai:             { type: aiUsageSchema },
    messaging:      { type: messagingUsageSchema },
    workflow:       { type: workflowUsageSchema },

    // ── Cost ──────────────────────────────────────────────────────────
    cost:           { type: costSchema, required: true },

    // ── Failure detail (if status = failed) ───────────────────────────
    error:          { type: String },

    // ── Catch-all for provider-specific raw data ───────────────────────
    // e.g. WhatsApp pricing object, raw OpenAI usage response
    raw:            { type: Schema.Types.Mixed },

}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Dashboard: "show me all logs for business X in date range"
BillingLogSchema.index({ business: 1, createdAt: -1 });

// Category breakdown: "show me all AI usage for business X"
BillingLogSchema.index({ business: 1, category: 1, createdAt: -1 });

// Conversation drill-down: "how much did this conversation cost?"
BillingLogSchema.index({ "source.conversation": 1 });

// Campaign cost totals
BillingLogSchema.index({ "source.campaign": 1 });

// Failed billing reconciliation
BillingLogSchema.index({ business: 1, status: 1 });

export const BillingLog = model('BillingLog', BillingLogSchema, 'BillingLogs');