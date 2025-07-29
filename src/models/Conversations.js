import { model, Schema } from 'mongoose';
import { Message } from './Messages.js';
import { Agent, run } from '@openai/agents';
const ConversationStatusEnum = ["initiated", "active", "interrupted", "inactive", "disconnected"];
const ConversationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    channel: String,
    telegramChatId: String,
    whatsappChatId: String,
    contact: Schema.Types.Mixed,
    agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
    status: { type: String, enum: ConversationStatusEnum, default: "initiated" },
    sockets: {
        socketId: String,
        disconnectReason: String,
    },
    /** Conversation state & runtime extras */
    session: Schema.Types.Mixed,
    state: String,
    pendingInterruptions: [{ type: Schema.Types.Mixed }],
    /** ---------------- Analytics buckets ---------------- */
    geoLocation: Schema.Types.Mixed,
    analysisMetrics: Schema.Types.Mixed,
    analysisTokens: {
        model: String,
        usage: { type: Schema.Types.Mixed }
    },
    metadata: { totalMessages: Number, reactions: { neutral: Number, like: Number, dislike: Number } }
}, {
    timestamps: true
});
ConversationSchema.methods.updateAnalytics = async function () {
    const messages = await Message.find({ conversationId: this._id });
    this.metadata = {
        totalMessages: messages.length,
        reactions: messages.reduce((acc, msg) => {
            acc[msg.reaction] = (acc[msg.reaction] || 0) + 1;
            return acc;
        }, { neutral: 0, like: 0, dislike: 0 })
    };
    const formatted = messages.map(m => `User: ${m.query}\nAgent: ${m.response}`).join("\n\n");
    const agentDetails = await this.populate('agent');
    if (agentDetails.agent.analysisMetrics) {
        console.log("metrics : ",agentDetails.agent.analysisMetrics)
        const agent = new Agent({
            name: "Conversation Analyzer",
            instructions: "Analyze the provided conversation history to assess the user's engagement level, interests, and qualification status. Extract key behavioral indicators, determine their role and intent, assign a lead score (0-100), and categorize their interest areas. Return your analysis in the exact JSON structure specified by the outputType schema.",
            model: "gpt-4.1-mini",
            temperature: 0.2,
            outputType: agentDetails.agent.analysisMetrics, // write a response schema
        });
        const result = await run(agent, `formatted conversation :${formatted}`, { stream: false });
        const usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        result.rawResponses.forEach((ele) => {
            usage.input_tokens += ele.usage.inputTokens;
            usage.output_tokens += ele.usage.outputTokens;
            usage.total_tokens += ele.usage.totalTokens;
        });
        this.analysisTokens = {
            model: "gpt-4.1-mini",
            usage: usage
        };
        this.analysisMetrics = JSON.parse(result.finalOutput);
    }

    await this.save();
}
export const Conversation = model('Conversation', ConversationSchema, "Conversations");