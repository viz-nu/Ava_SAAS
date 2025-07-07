import { model, Schema } from 'mongoose';

const BusinessSchema = new Schema({
    name: String,
    logoURL: String,
    facts: [String],
    quickQuestions: [{ label: String, value: String }],
    sector: String,
    tagline: String,
    address: String,
    description: String,
    contact: {
        mail: String,
        phone: String,
        website: String
    },
    // modelIntegrations: { OpenAi: { apiKey: String, name: String, id: String, redacted_value: String, created_at: Date } },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    docData: { type: Schema.Types.Mixed },
    members: [{ type: Schema.Types.ObjectId, ref: 'Users' }],
    agents: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
    actions: [{ type: Schema.Types.ObjectId, ref: 'Action' }],
    collections: [{ type: Schema.Types.ObjectId, ref: 'Collection' }],
    documents: [{ type: Schema.Types.ObjectId, ref: "document" }],
    analytics: {
        lastUpdated: Date,
        engagementOverview: {
            agentWiseBreakdown: [{
                agent: { type: Schema.Types.ObjectId, ref: 'Agent' },
                conversations: {
                    today: { type: Number, default: 0 },
                    thisWeek: { type: Number, default: 0 },
                    thisMonth: { type: Number, default: 0 },
                    total: { type: Number, default: 0 },
                    averageSessionDurationInSeconds: { type: Number, default: 0 },
                    engagementTimeSlots: { type: [Number], default: () => Array(24).fill(0) },
                    engagementScale: { type: Number, default: 1 }
                }
            }],
        },
        conversationAnalytics: Schema.Types.Mixed,
        creditsUsage: {
            knowledgeCosts: {
                totalKnowledgeTokensUsed: { type: Number, default: 0 },
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
export const Business = model('Businesses', BusinessSchema, "Businesses");