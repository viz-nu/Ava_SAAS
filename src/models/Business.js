import { model, Schema } from 'mongoose';

const AgentEngagementSchema = new Schema({
    agent: { type: { type: Schema.Types.ObjectId, ref: "Agent" }, default: "" },
    channel: { type: { type: Schema.Types.ObjectId, ref: "Channel" }, default: "" },
    totalConversations: { type: Number, default: 0 },
    // totalDurationInSeconds: { type: Number, default: 0 },
    averageSessionDurationInSeconds: { type: Number, default: 0 },
    engagementTimeSlots: { type: [Number], default: () => new Array(24).fill(0) },
    dailyConversationCounts: {
        type: Schema.Types.Mixed, // or simply: Object
        default: () => ({})
    },
    dailyConversationCountsStartDate: { type: Date, default: null },
    engagementScale: { type: Number, default: 1 }
}, { _id: false });
const BusinessSchema = new Schema({
    name: String,
    logoURL: String,
    facts: [String],
    quickQuestions: [{ label: String, value: String }],
    sector: String,
    tagline: String,
    address: String,
    description: String,
    MAX_DAYS: { type: Number, default: 45 },
    contact: {
        mail: String,
        phone: String,
        website: String
    },
    createdBy: { type: { type: Schema.Types.ObjectId, ref: "Users" }, default: "" },
    docData: Schema.Types.Mixed,
    members: { type: [{ type: Schema.Types.ObjectId, ref: "Users" }], default: [] },
    documents: { type: [{ type: Schema.Types.ObjectId, ref: "document" }], default: [] },
    analytics: {
        lastUpdated: Date,
        engagementOverview: {
            agentWiseBreakdown: [AgentEngagementSchema]
        },
        conversationAnalytics: Schema.Types.Mixed,
        creditsUsage: {
            knowledgeCosts: {
                totalEmbeddingTokens: { type: Number, default: 0 },
                TotalSummarizationInputTokens: { type: Number, default: 0 },
                TotalSummarizationOutputTokens: { type: Number, default: 0 },
                TotalSummarizationTotalTokens: { type: Number, default: 0 },
                OverAllKnowledgeCost: { type: Number, default: 0 },
            },
            chatCosts: {
                totalChatTokensUsed: { type: Number, default: 0 },
                costOfInputChatTokens: { type: Number, default: 0 },
                costOfOutputChatTokens: { type: Number, default: 0 },
                OverAllChatCost: { type: Number, default: 0 },
            },
            analysisCosts: {
                totalAnalysisTokensUsed: { type: Number, default: 0 },
                costOfInputAnalysisTokens: { type: Number, default: 0 },
                costOfOutputAnalysisTokens: { type: Number, default: 0 },
                OverAllAnalysisCost: { type: Number, default: 0 },
            },
            miscellaneousCosts: {}
        }
    }
}, {
    timestamps: true
});
BusinessSchema.methods.pruneOldConversationDates = function () {
    const breakdown = this.analytics.engagementOverview.agentWiseBreakdown;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.MAX_DAYS);
    for (const agentStat of breakdown) {
        const counts = agentStat.dailyConversationCounts;
        // ⛔ Skip if no old data
        if (!agentStat.dailyConversationCountsStartDate || agentStat.dailyConversationCountsStartDate >= cutoff) continue;
        let earliestDate = null;
        for (const dateStr of Object.keys(counts)) {
            const date = new Date(dateStr);
            if (date < cutoff) {
                delete counts[dateStr];
            } else {
                if (!earliestDate || date < earliestDate) earliestDate = date;
            }
        }
        agentStat.dailyConversationCountsStartDate = earliestDate;
    }
};
BusinessSchema.methods.addEngagementAnalytics = function (agentId, createdAt, updatedAt, channelId) {
    const dateStr = createdAt.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    const duration = (updatedAt - createdAt) / 1000;
    const breakdown = this.analytics.engagementOverview.agentWiseBreakdown;
    let agentStat = breakdown.find(a => a.agent.toString() === agentId.toString());
    if (!agentStat) {
        breakdown.push({
            agent: agentId,
            channel: channelId,
            totalConversations: 0,
            averageSessionDurationInSeconds: 0,
            engagementTimeSlots: new Array(24).fill(0),
            dailyConversationCounts: {},
            dailyConversationCountsStartDate: new Date(dateStr),
            engagementScale: 1
        });
        agentStat = breakdown[breakdown.length - 1]; // ← now it’s a tracked subdoc
    }
    if (!agentStat.dailyConversationCountsStartDate || new Date(dateStr) < agentStat.dailyConversationCountsStartDate) {
        agentStat.dailyConversationCountsStartDate = new Date(dateStr);
    }
    // ⬆️ Increment counters
    agentStat.averageSessionDurationInSeconds = parseInt(((agentStat.averageSessionDurationInSeconds * agentStat.totalConversations) + duration) / (agentStat.totalConversations + 1));
    // 🕒 Time slot engagement
    const startHour = createdAt.getHours();
    const endHour = Math.min(updatedAt.getMinutes() > 15 ? updatedAt.getHours() + 1 : updatedAt.getHours(), 23);
    for (let h = startHour; h <= endHour; h++) {
        if (h >= 0 && h < 24) {
            agentStat.engagementTimeSlots[h]++;
        } else {
            console.warn(`Invalid hour index: ${h}`);
        }
    }
    // 📅 Daily count
    agentStat.totalConversations++;
    agentStat.dailyConversationCounts[dateStr] = (agentStat.dailyConversationCounts[dateStr] || 0) + 1;
};
BusinessSchema.methods.addTokenUsage = function (type, data) {

}



export const Business = model('Businesses', BusinessSchema, "Businesses");