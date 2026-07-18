import { model, Schema } from 'mongoose';

const TranscriptSchema = new Schema({
    speaker: { type: String, enum: ["Lead", "agent", "user", "system"] },
    transcript: String,
    startMs: Number,                 // offset from call start
    endMs: Number,
    confidence: Number,
    source: String,                  // provider | whisper | deepgram | …
    usage: Schema.Types.Mixed,
}, { _id: false });
const CallSessionSchema = new Schema({
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    channel: { type: Schema.Types.ObjectId, ref: "Channel" },
    externalCallSessionId: String,
    direction: String,
    status: { type: String, enum: ["initiated", "ringing", "in_progress", "completed", "failed", "busy", "no_answer", "canceled"], default: "initiated" },
    statusTimeline: {
        initiatedAt: Date, ringingAt: Date, in_progressAt: Date, completedAt: Date, failedAt: Date, busyAt: Date, no_answerAt: Date, cancelledAt: Date, durationSec: { type: Number, default: 0 },
    },
    recording: { status: { type: String, enum: ["none", "pending", "stored", "failed"], default: "none" }, key: String, url: String },
    transcripts: { type: [TranscriptSchema], default: [] }, // see note in chat re: very long calls
    callDetails: Schema.Types.Mixed,
    sequenceOfEvents: [Schema.Types.Mixed]
}, {
    timestamps: true
});
export const CallSession = model('CallSession', CallSessionSchema, 'CallSession');