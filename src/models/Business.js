import { model, Schema } from 'mongoose';
import { Subscription } from './Subscriptions.js';
import { Payment } from './Payments.js';

const AgentEngagementSchema = new Schema({
    agent: { type: Schema.Types.ObjectId, ref: "Agent" },
    channel: { type: String, enum: ['email', 'whatsapp', 'telegram', 'web', 'phone', 'sms', 'instagram'], default: "web" },
    channelFullDetails: { type: Schema.Types.ObjectId, ref: "Channel" },
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
    createdBy: { type: Schema.Types.ObjectId, ref: "Users" },
    docData: Schema.Types.Mixed,
    // members: [{ type: Schema.Types.ObjectId, ref: "Users" }],
    documents: [{ type: Schema.Types.ObjectId, ref: "document" }],
    credits: {
        activePlan: { type: Schema.Types.ObjectId, ref: "Payments" },
        IsCreditSharingEnabled: { type: Boolean, default: false },
        llmCredits: { type: Number, default: 0, min: 0 },
        knowledgeCredits: { type: Number, default: 0, min: 0 },
        miscellaneousCredits: { type: Number, default: 0, min: 0 },
        spendRatio: { type: Number, enum: [1080, 1666, 1583], default: 1080 },
        balance: { type: Number, default: 1250 },
        lastUpdated: { type: Date, default: new Date() }
    },
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
BusinessSchema.methods.addEngagementAnalytics = function (agentId, createdAt, updatedAt, channelStr, channelId) {
    const dateStr = createdAt.toISOString().split("T")[0]; // 'YYYY-MM-DD'
    const duration = (updatedAt - createdAt) / 1000;
    const breakdown = this.analytics.engagementOverview.agentWiseBreakdown;
    let agentStat = breakdown.find(a => a.agent.toString() === agentId.toString());
    if (!agentStat) {
        breakdown.push({
            agent: agentId,
            channel: channelStr || "web",
            channelFullDetails: channelId || null,
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
BusinessSchema.pre('save', async function (next) {
    if (this.isNew) {
        const freeSubscription = await Subscription.findById("695041ea48766e61bd258313");
        const payment = await Payment.create({
            business: this._id,
            createdBy: this.createdBy,
            subscription: freeSubscription._id,
            gateway: 'other',
            type: 'one_time',
            amount: {
                value: freeSubscription.price.amount,
                currency: freeSubscription.price.currency
            },
            metadata: {
                expiresAt: new Date(Date.now() + freeSubscription.validity * 24 * 60 * 60 * 1000), // 7 days
                status: 'created'
            }
        });
        this.credits = {
            activePlan: payment._id,
            llmCredits: freeSubscription.credits.llm,
            knowledgeCredits: freeSubscription.credits.knowledge,
            miscellaneousCredits: freeSubscription.credits.miscellaneous,
            spendRatio: freeSubscription.spendRatio,
            balance: freeSubscription.credits.llm + freeSubscription.credits.knowledge + freeSubscription.credits.miscellaneous,
            lastUpdated: new Date(),
        }
    }
    next();
});
BusinessSchema.methods.UpdateCredits = async function (credits) {
    const { llmCredits, knowledgeCredits, miscellaneousCredits, spendRatio } = credits;
    this.credits.llmCredits += llmCredits;
    this.credits.knowledgeCredits += knowledgeCredits;
    this.credits.miscellaneousCredits += miscellaneousCredits;
    this.credits.spendRatio = spendRatio;
    this.credits.balance += llmCredits + knowledgeCredits + miscellaneousCredits;
    this.credits.lastUpdated = new Date();
    await this.save();
}
export const Business = model('Businesses', BusinessSchema, "Businesses");