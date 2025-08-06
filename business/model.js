import { model, Schema } from 'mongoose';

const AgentEngagementSchema = new Schema({
    agent: {
        type: Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
        index: true
    },
    channel: {
        type: String,
        enum: ['email', 'whatsapp', 'telegram', 'web', 'phone', 'sms', 'instagram'],
        default: "web",
        index: true
    },
    channelFullDetails: {
        type: Schema.Types.ObjectId,
        ref: "Channel"
    },
    totalConversations: {
        type: Number,
        default: 0,
        min: 0
    },
    averageSessionDurationInSeconds: {
        type: Number,
        default: 0,
        min: 0
    },
    engagementTimeSlots: {
        type: [Number],
        default: () => new Array(24).fill(0),
        validate: {
            validator: function (arr) {
                return arr.length === 24;
            },
            message: 'engagementTimeSlots must have exactly 24 elements'
        }
    },
    dailyConversationCounts: {
        type: Schema.Types.Mixed,
        default: () => ({})
    },
    dailyConversationCountsStartDate: {
        type: Date,
        default: null,
        index: true
    },
    engagementScale: {
        type: Number,
        default: 1,
        min: 0.1,
        max: 10
    }
}, {
    _id: false,
    minimize: false
});

// Optimized cost tracking schemas
const TokenCostSchema = new Schema({
    totalTokens: { type: Number, default: 0, min: 0 },
    inputTokens: { type: Number, default: 0, min: 0 },
    outputTokens: { type: Number, default: 0, min: 0 },
    totalCost: { type: Number, default: 0, min: 0 },
    inputCost: { type: Number, default: 0, min: 0 },
    outputCost: { type: Number, default: 0, min: 0 }
}, { _id: false });

const BusinessSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 200,
        index: true
    },
    logoURL: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                return !v || /^https?:\/\/.+/.test(v);
            },
            message: 'logoURL must be a valid URL'
        }
    },
    facts: [{
        type: String,
        trim: true,
        maxLength: 1000
    }],
    quickQuestions: [{
        label: {
            type: String,
            required: true,
            trim: true,
            maxLength: 200
        },
        value: {
            type: String,
            required: true,
            trim: true,
            maxLength: 500
        }
    }],
    sector: {
        type: String,
        trim: true,
        maxLength: 100,
        index: true
    },
    tagline: {
        type: String,
        trim: true,
        maxLength: 200
    },
    address: {
        type: String,
        trim: true,
        maxLength: 500
    },
    description: {
        type: String,
        trim: true,
        maxLength: 2000
    },
    MAX_DAYS: {
        type: Number,
        default: 45,
        min: 1,
        max: 365
    },
    contact: {
        mail: {
            type: String,
            trim: true,
            lowercase: true,
            validate: {
                validator: function (v) {
                    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
                },
                message: 'Invalid email format'
            }
        },
        phone: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^\+?[\d\s\-\(\)]{7,20}$/.test(v);
                },
                message: 'Invalid phone format'
            }
        },
        website: {
            type: String,
            trim: true,
            validate: {
                validator: function (v) {
                    return !v || /^https?:\/\/.+/.test(v);
                },
                message: 'Website must be a valid URL'
            }
        }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true,
        index: true
    },
    docData: Schema.Types.Mixed,
    documents: [{
        type: Schema.Types.ObjectId,
        ref: "document"
    }],
    analytics: {
        lastUpdated: {
            type: Date,
            default: () => new Date(0),
            index: true
        },
        engagementOverview: {
            agentWiseBreakdown: [AgentEngagementSchema]
        },
        conversationAnalytics: {
            type: Schema.Types.Mixed,
            default: () => ({})
        },
        creditsUsage: {
            knowledgeCosts: {
                totalEmbeddingTokens: { type: Number, default: 0, min: 0 },
                totalSummarizationInputTokens: { type: Number, default: 0, min: 0 },
                totalSummarizationOutputTokens: { type: Number, default: 0, min: 0 },
                totalSummarizationTotalTokens: { type: Number, default: 0, min: 0 },
                overAllKnowledgeCost: { type: Number, default: 0, min: 0 }
            },
            chatCosts: {
                totalChatTokensUsed: { type: Number, default: 0, min: 0 },
                costOfInputChatTokens: { type: Number, default: 0, min: 0 },
                costOfOutputChatTokens: { type: Number, default: 0, min: 0 },
                overAllChatCost: { type: Number, default: 0, min: 0 }
            },
            analysisCosts: {
                totalAnalysisTokensUsed: { type: Number, default: 0, min: 0 },
                costOfInputAnalysisTokens: { type: Number, default: 0, min: 0 },
                costOfOutputAnalysisTokens: { type: Number, default: 0, min: 0 },
                overAllAnalysisCost: { type: Number, default: 0, min: 0 }
            },
            miscellaneousCosts: {
                type: Schema.Types.Mixed,
                default: () => ({})
            }
        }
    }
}, {
    timestamps: true,
    minimize: false,
    collection: 'Businesses'
});

// Indexes for better query performance
BusinessSchema.index({ createdBy: 1, createdAt: -1 });
BusinessSchema.index({ sector: 1, createdAt: -1 });
BusinessSchema.index({ 'analytics.lastUpdated': 1 });
BusinessSchema.index({ name: 'text', description: 'text', tagline: 'text' });

// Optimized pruning method with better performance
BusinessSchema.methods.pruneOldConversationDates = function () {
    const breakdown = this.analytics.engagementOverview.agentWiseBreakdown;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.MAX_DAYS);

    let totalPruned = 0;

    for (const agentStat of breakdown) {
        const counts = agentStat.dailyConversationCounts;

        // Skip if no old data
        if (!agentStat.dailyConversationCountsStartDate ||
            agentStat.dailyConversationCountsStartDate >= cutoff) {
            continue;
        }

        let earliestDate = null;
        let prunedCount = 0;

        // Get all date keys and sort them for efficient processing
        const dateKeys = Object.keys(counts).sort();

        for (const dateStr of dateKeys) {
            const date = new Date(dateStr);

            if (date < cutoff) {
                delete counts[dateStr];
                prunedCount++;
            } else {
                if (!earliestDate || date < earliestDate) {
                    earliestDate = date;
                }
            }
        }

        agentStat.dailyConversationCountsStartDate = earliestDate;
        totalPruned += prunedCount;
    }

    return totalPruned;
};

// Optimized engagement analytics method
BusinessSchema.methods.addEngagementAnalytics = function (agentId, createdAt, updatedAt, channelStr, channelId) {
    // Input validation
    if (!agentId || !createdAt) {
        console.warn('Invalid parameters for addEngagementAnalytics');
        return false;
    }

    const dateStr = createdAt.toISOString().split("T")[0];
    const duration = Math.max(0, (updatedAt - createdAt) / 1000); // Ensure non-negative
    const breakdown = this.analytics.engagementOverview.agentWiseBreakdown;

    let agentStat = breakdown.find(a => a.agent.toString() === agentId.toString());

    if (!agentStat) {
        // Create new agent stat
        const newStat = {
            agent: agentId,
            channel: channelStr || "web",
            channelFullDetails: channelId || null,
            totalConversations: 0,
            averageSessionDurationInSeconds: 0,
            engagementTimeSlots: new Array(24).fill(0),
            dailyConversationCounts: {},
            dailyConversationCountsStartDate: new Date(dateStr),
            engagementScale: 1
        };
        breakdown.push(newStat);
        agentStat = newStat;
    }

    // Update start date if this is earlier
    const currentStartDate = agentStat.dailyConversationCountsStartDate;
    if (!currentStartDate || new Date(dateStr) < currentStartDate) {
        agentStat.dailyConversationCountsStartDate = new Date(dateStr);
    }

    // Calculate new average duration using incremental formula
    const currentTotal = agentStat.totalConversations;
    const currentAvg = agentStat.averageSessionDurationInSeconds;
    agentStat.averageSessionDurationInSeconds = Math.round(
        ((currentAvg * currentTotal) + duration) / (currentTotal + 1)
    );

    // Update time slot engagement safely
    try {
        const startHour = createdAt.getHours();
        const endHour = Math.min(
            updatedAt.getMinutes() > 15 ? updatedAt.getHours() + 1 : updatedAt.getHours(),
            23
        );

        for (let h = startHour; h <= endHour; h++) {
            if (h >= 0 && h < 24) {
                agentStat.engagementTimeSlots[h]++;
            }
        }
    } catch (error) {
        console.warn('Error updating time slots:', error.message);
    }

    // Update counters
    agentStat.totalConversations++;
    agentStat.dailyConversationCounts[dateStr] = (agentStat.dailyConversationCounts[dateStr] || 0) + 1;

    return true;
};

// Method to add token usage with validation
BusinessSchema.methods.addTokenUsage = function (type, model, inputTokens = 0, outputTokens = 0, totalCost = 0) {
    if (!this.analytics) {
        this.analytics = {
            lastUpdated: new Date(0),
            engagementOverview: { agentWiseBreakdown: [] },
            conversationAnalytics: {},
            creditsUsage: {
                knowledgeCosts: {
                    totalEmbeddingTokens: 0,
                    totalSummarizationInputTokens: 0,
                    totalSummarizationOutputTokens: 0,
                    totalSummarizationTotalTokens: 0,
                    overAllKnowledgeCost: 0
                },
                chatCosts: {
                    totalChatTokensUsed: 0,
                    costOfInputChatTokens: 0,
                    costOfOutputChatTokens: 0,
                    overAllChatCost: 0
                },
                analysisCosts: {
                    totalAnalysisTokensUsed: 0,
                    costOfInputAnalysisTokens: 0,
                    costOfOutputAnalysisTokens: 0,
                    overAllAnalysisCost: 0
                },
                miscellaneousCosts: {}
            }
        };
    }

    const costs = this.analytics.creditsUsage;
    const totalTokens = inputTokens + outputTokens;

    switch (type) {
        case 'chat':
            costs.chatCosts.totalChatTokensUsed += totalTokens;
            costs.chatCosts.costOfInputChatTokens += inputTokens * this._getTokenRate(model, 'input');
            costs.chatCosts.costOfOutputChatTokens += outputTokens * this._getTokenRate(model, 'output');
            costs.chatCosts.overAllChatCost += totalCost;
            break;

        case 'analysis':
            costs.analysisCosts.totalAnalysisTokensUsed += totalTokens;
            costs.analysisCosts.costOfInputAnalysisTokens += inputTokens * this._getTokenRate(model, 'input');
            costs.analysisCosts.costOfOutputAnalysisTokens += outputTokens * this._getTokenRate(model, 'output');
            costs.analysisCosts.overAllAnalysisCost += totalCost;
            break;

        case 'knowledge':
            if (model === 'text-embedding-3-small') {
                costs.knowledgeCosts.totalEmbeddingTokens += totalTokens;
            } else {
                costs.knowledgeCosts.totalSummarizationInputTokens += inputTokens;
                costs.knowledgeCosts.totalSummarizationOutputTokens += outputTokens;
                costs.knowledgeCosts.totalSummarizationTotalTokens += totalTokens;
            }
            costs.knowledgeCosts.overAllKnowledgeCost += totalCost;
            break;

        default:
            costs.miscellaneousCosts[type] = (costs.miscellaneousCosts[type] || 0) + totalCost;
    }
};

// Helper method to get token rates (should be moved to a config file)
BusinessSchema.methods._getTokenRate = function (model, type) {
    const rates = {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
        'text-embedding-3-small': { input: 0.00002, output: 0 }
    };

    return rates[model]?.[type] || 0;
};

// Method to get analytics summary
BusinessSchema.methods.getAnalyticsSummary = function () {
    const costs = this.analytics?.creditsUsage;
    if (!costs) return null;

    return {
        totalCost: (costs.chatCosts?.overAllChatCost || 0) +
            (costs.analysisCosts?.overAllAnalysisCost || 0) +
            (costs.knowledgeCosts?.overAllKnowledgeCost || 0),
        totalTokens: (costs.chatCosts?.totalChatTokensUsed || 0) +
            (costs.analysisCosts?.totalAnalysisTokensUsed || 0) +
            (costs.knowledgeCosts?.totalEmbeddingTokens || 0) +
            (costs.knowledgeCosts?.totalSummarizationTotalTokens || 0),
        totalConversations: this.analytics.engagementOverview?.agentWiseBreakdown
            ?.reduce((sum, agent) => sum + (agent.totalConversations || 0), 0) || 0,
        lastUpdated: this.analytics?.lastUpdated
    };
};

// Method to reset analytics (useful for testing or data cleanup)
BusinessSchema.methods.resetAnalytics = function () {
    this.analytics = {
        lastUpdated: new Date(0),
        engagementOverview: { agentWiseBreakdown: [] },
        conversationAnalytics: {},
        creditsUsage: {
            knowledgeCosts: {
                totalEmbeddingTokens: 0,
                totalSummarizationInputTokens: 0,
                totalSummarizationOutputTokens: 0,
                totalSummarizationTotalTokens: 0,
                overAllKnowledgeCost: 0
            },
            chatCosts: {
                totalChatTokensUsed: 0,
                costOfInputChatTokens: 0,
                costOfOutputChatTokens: 0,
                overAllChatCost: 0
            },
            analysisCosts: {
                totalAnalysisTokensUsed: 0,
                costOfInputAnalysisTokens: 0,
                costOfOutputAnalysisTokens: 0,
                overAllAnalysisCost: 0
            },
            miscellaneousCosts: {}
        }
    };
};

// Static method to find businesses with stale analytics
BusinessSchema.statics.findStaleAnalytics = function (olderThanMinutes = 5) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return this.find({
        $or: [
            { 'analytics.lastUpdated': { $lt: cutoff } },
            { 'analytics.lastUpdated': { $exists: false } }
        ]
    }).select('_id name analytics.lastUpdated');
};

// Pre-save middleware for validation and optimization
BusinessSchema.pre('save', function (next) {
    // Ensure analytics structure exists
    if (!this.analytics) {
        this.resetAnalytics();
    }

    // Validate engagement time slots
    if (this.analytics.engagementOverview?.agentWiseBreakdown) {
        for (const agent of this.analytics.engagementOverview.agentWiseBreakdown) {
            if (!agent.engagementTimeSlots || agent.engagementTimeSlots.length !== 24) {
                agent.engagementTimeSlots = new Array(24).fill(0);
            }
        }
    }

    // Clean up old conversation data automatically if it's been too long
    if (this.isModified('analytics.engagementOverview.agentWiseBreakdown')) {
        this.pruneOldConversationDates();
    }

    next();
});

// Post-save middleware for logging
BusinessSchema.post('save', function (doc) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Business ${doc._id} analytics updated at ${doc.analytics?.lastUpdated}`);
    }
});

// Create and export the model
export const Business = model('Businesses', BusinessSchema, 'Businesses');