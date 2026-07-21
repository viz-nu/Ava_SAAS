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
    lead: { type: Schema.Types.ObjectId, ref: 'Lead' },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    campaign: Schema.Types.ObjectId, // participant of the campaign(bulk messaging)
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    channel: { type: Schema.Types.ObjectId, ref: "Channel" },
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    externalCallSessionId: String,
    direction: String,
    statusTimeline: {
        scheduledAt: Date, initiatedAt: Date, ringingAt: Date, in_progressAt: Date, completedAt: Date, failedAt: Date, busyAt: Date, no_answerAt: Date, canceledAt: Date, rejectedAt: Date, durationSec: { type: Number, default: 0 },
    },
    recording: { status: { type: String, enum: ["none", "pending", "stored", "failed"], default: "none" }, key: String, url: String },
    transcripts: { type: [TranscriptSchema], default: [] }, // see note in chat re: very long calls
    callDetails: Schema.Types.Mixed,
    sequenceOfEvents: [Schema.Types.Mixed],
    isSummarized: { type: Boolean, default: false }
}, {
    timestamps: true
});
export const CallSession = model('CallSession', CallSessionSchema, 'CallSession');