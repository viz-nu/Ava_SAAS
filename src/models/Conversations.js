import { model, Schema } from 'mongoose';
import { Message } from './Messages.js';
import { Agent, run } from '@openai/agents';
import { buildJSONSchema } from '../utils/tools.js';
// const ConversationStatusEnum = ["initiated", "active", "interrupted", "inactive", "disconnected"];
const TranscriptionSchema = new Schema({
    transcript: String,
    timestamp: Date,
    speaker: String,
    source: String,
    usage: Schema.Types.Mixed
});
const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    channel: { type: String, enum: ['email', 'whatsapp', 'telegram', 'web', 'phone', 'sms', 'instagram'], default: "web" },
    channelFullDetails: { type: Schema.Types.ObjectId, ref: "Channel" },
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign" },
    voiceCallIdentifierNumberSID: String,
    input: [Schema.Types.Mixed],
    telegramChatId: String,
    whatsappChatId: String,
    contact: Schema.Types.Mixed,
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    /** Conversation state & runtime extras */
    session: Schema.Types.Mixed,
    state: String,
    /** ---------------- Analytics buckets ---------------- */
    extractedData: Schema.Types.Mixed,
    analysisTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    VoiceCallTokens: {
        model: String,
        total_text_input_tokens: Number,
        total_audio_input_tokens: Number,
        total_text_output_tokens: Number,
        total_audio_output_tokens: Number,
        total_cached_text: Number,
        total_cached_audio: Number,
        input_Transcript_Duration_whisper: Number
    },
    transcripts: [TranscriptionSchema],
    PreContext: String,
    metadata: {
        status: { type: String, default: "initiated" },
        pendingInterruptions: [{ type: Schema.Types.Mixed }],
        totalMessages: Number,
        reactions: { neutral: Number, like: Number, dislike: Number },
        sockets: {
            socketId: String,
            disconnectReason: String,
        },
        browserUrl: String,
        userLocation: Schema.Types.Mixed,
        callDetails: Schema.Types.Mixed,
        sequenceOfEvents: [Schema.Types.Mixed],
        CreditsUsage: {
            conversationCredits: { type: Number, default: 0 },
            analysisCredits: { type: Number, default: 0 },
            // knowledgeCredits:Number,
            miscellaneousCredits: { type: Number, default: 0 },
            totalCredits: { type: Number, default: 0 },
        }
    }
}, {
    timestamps: true
});
export const Conversation = model('Conversation', ConversationSchema, "Conversations");