import { model, Schema } from 'mongoose';
import { Subscription } from './Subscriptions.js';
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
    freeTrailClaimed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "Users" },
    docData: Schema.Types.Mixed,
    // members: [{ type: Schema.Types.ObjectId, ref: "Users" }],
    documents: [{ type: Schema.Types.ObjectId, ref: "document" }],
    credits: {
        activePlan: { type: Schema.Types.ObjectId, ref: "Subscriptions" },
        IsCreditSharingEnabled: { type: Boolean, default: false },
        IsPlanInActive: { type: Boolean, default: true },
        llmCredits: { type: Number, default: 0, min: 0 },
        knowledgeCredits: { type: Number, default: 0, min: 0 },
        miscellaneousCredits: { type: Number, default: 0, min: 0 },
        spendRatio: { type: Number, enum: [1080, 1666, 1583], default: 1080 },
        balance: { type: Number, default: 0 },
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
BusinessSchema.methods.checkSubscriptionStatus = async function () {
    const subscription = await Subscription.findById(this.credits.activePlan);
    if (!subscription) return "inactive";
    if (subscription.metadata.expiresAt < new Date()) return "inactive";
    if (subscription.metadata.status !== "active") return "inactive";
    return "active";
    if (!plan) throw new Error("Plan not found");
    if (plan.type === "FREE") {
        return "free";
    }
    return "active";
}
BusinessSchema.methods.UpdateCredits = async function (options = {}) {
    const { operation = 'set', spendRatio, autoSave = true, activePlan, isPlanInActive = false } = options;
    // Ensure credits object exists
    if (!this.credits) this.credits = { llmCredits: 0, knowledgeCredits: 0, miscellaneousCredits: 0, balance: 0, spendRatio: 1080 };
    // Initialize current values
    const current = { llmCredits: this.credits.llmCredits || 0, knowledgeCredits: this.credits.knowledgeCredits || 0, miscellaneousCredits: this.credits.miscellaneousCredits || 0 };
    // Process each credit type based on operation
    const creditTypes = ['llmCredits', 'knowledgeCredits', 'miscellaneousCredits'];
    let hasChanges = false;
    creditTypes.forEach(creditType => {
        const value = options[creditType];
        if (value === undefined || value === null) return;
        const numericValue = Number(value);
        if (isNaN(numericValue)) return;
        let newValue;
        switch (operation) {
            case 'add':
                newValue = current[creditType] + numericValue;
                break;
            case 'remove':
            case 'subtract':
                newValue = Math.max(0, current[creditType] - numericValue); // Prevent negative values
                break;
            case 'set':
                newValue = Math.max(0, numericValue); // Prevent negative values
                break;
            case 'reset':
                newValue = 0;
                break;
            default:
                throw new Error(`Invalid operation: ${operation}. Must be 'add', 'remove', 'set', or 'reset'`);
        }

        if (this.credits[creditType] !== newValue) {
            this.credits[creditType] = newValue;
            hasChanges = true;
        }
    });

    // Update spendRatio if provided
    if (spendRatio !== undefined && spendRatio !== null) {
        const validRatios = [1080, 1666, 1583];
        if (validRatios.includes(spendRatio)) {
            if (this.credits.spendRatio !== spendRatio) {
                this.credits.spendRatio = spendRatio;
                hasChanges = true;
            }
        } else {
            console.warn(`Invalid spendRatio: ${spendRatio}. Must be one of: ${validRatios.join(', ')}`);
        }
    }
    if (typeof isPlanInActive === 'boolean') {
        this.credits.IsPlanInActive = isPlanInActive;
        hasChanges = true;
    }
    if (activePlan) {
        this.credits.activePlan = activePlan;
        hasChanges = true;
    }
    // Recalculate balance
    const newBalance = (this.credits.llmCredits || 0) + (this.credits.knowledgeCredits || 0) + (this.credits.miscellaneousCredits || 0);
    if (this.credits.balance !== newBalance) {
        this.credits.balance = newBalance;
        hasChanges = true;
    }
    // Update timestamp if there were any changes
    if (hasChanges) this.credits.lastUpdated = new Date();
    // Save if autoSave is enabled and there were changes
    if (autoSave && hasChanges) await this.save();
    return {
        llmCredits: this.credits.llmCredits,
        knowledgeCredits: this.credits.knowledgeCredits,
        miscellaneousCredits: this.credits.miscellaneousCredits,
        spendRatio: this.credits.spendRatio,
        balance: this.credits.balance,
        lastUpdated: this.credits.lastUpdated
    };
}
export const Business = model('Businesses', BusinessSchema, "Businesses");