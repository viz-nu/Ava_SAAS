import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { Data } from "../../models/Data.js";
import { Message } from "../../models/Messages.js";
import { sendMail } from "../../utils/sendEmail.js";
import { analyzeQueries } from "../../utils/nlp.js";
import { Conversation } from "../../models/Conversations.js";
import { calculateCost } from "../../utils/openai.js";
import { Collection } from "../../models/Collection.js";
import { AgentModel } from "../../models/Agent.js";
export const Dashboard = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).select("collections name logoURL facts sector tagline address description contact");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const collectionsInBusiness = await Collection.find({ business: req.user.business }, "_id")
    const agentsInBusiness = await AgentModel.find({ business: req.user.business }, "_id")
    const aggregationQueries = [
        Data.aggregate([
            { $match: { collection: { $in: collectionsInBusiness.map(ele => ele._id) } } },
            { $group: { _id: null, totalKnowledgeTokensUsed: { $sum: "$metadata.tokenUsage.embeddingTokens" } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: "$responseTokens.model", totalChatTokensUsed: { $sum: "$responseTokens.usage.total_tokens" }, inputChatTokensUsed: { $sum: "$responseTokens.usage.input_tokens" }, outputChatTokensUsed: { $sum: "$responseTokens.usage.output_tokens" } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: "$reaction", count: { $sum: 1 } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $unwind: "$Actions" },
            { $group: { _id: "$Actions.intent", count: { $sum: 1 } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: null, totalActionTokensUsed: { $sum: "$actionTokens.usage.total_tokens" } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: null, totalAnalysisTokensUsed: { $sum: "$analysisTokens.usage.total_tokens" } } }
        ]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: "$query" } }
        ]).then(results => {
            const queries = results.map(result => result._id); // Extract queries from aggregation result
            return analyzeQueries(queries);
        }),
        Message.aggregate([
            { $match: { business: business._id } },
            { $unwind: "$analysis" }, // Expand the analysis array,
            {
                $facet: {
                    intentFrequency: [{
                        $group: {
                            _id: "$analysis.intent",
                            count: { $sum: 1 }
                        }
                    }, { $sort: { count: -1 } }
                    ]
                }
            }
        ]),
        (async () => {
            const locations = [];
            for (const ele of agentsInBusiness) {
                const facets = await Conversation.aggregate([
                    { $match: { business: req.user.business, agent: ele._id, "geoLocation.city": { $exists: true, $ne: "" }, "geoLocation.country_name": { $exists: true, $ne: "" } } },
                    { $group: { _id: { city: "$geoLocation.city", country: "$geoLocation.country_name" }, count: { $sum: 1 } } },
                    { $sort: { count: -1 } }
                ]);
                locations.push({ agent: { _id: ele._id, name: ele.personalInfo.name }, data: facets });
            }
            return locations;
        })()
    ];
    const [
        knowledgeTokensRes,
        chatTokensRes,
        reactionsRes,
        actionsRes,
        actionTokensRes,
        analysisTokensRes,
        analysis, // for all queries do analyzeQueries(queries) and store in the output
        NewAnalysis,
        locations
    ] = await Promise.all(aggregationQueries);
    let totalKnowledgeTokensUsed = 0, OverAllKnowledgeCost = 0;
    for (const ele of knowledgeTokensRes) {
        totalKnowledgeTokensUsed += ele.totalKnowledgeTokensUsed
        let { totalCost = 0 } = calculateCost("text-embedding-3-small", ele.totalKnowledgeTokensUsed, 0)
        OverAllKnowledgeCost += totalCost
    }
    let totalChatTokensUsed = 0, costOfInputChatTokens = 0, costOfOutputChatTokens = 0, OverAllChatCost = 0;
    for (const ele of chatTokensRes) {
        totalChatTokensUsed += Number(ele.totalChatTokensUsed)
        const { inputCost = 0, outputCost = 0, totalCost = 0 } = calculateCost(ele._id, ele.inputChatTokensUsed, ele.outputChatTokensUsed) || {};
        costOfInputChatTokens += inputCost;
        costOfOutputChatTokens += outputCost;
        OverAllChatCost += totalCost;
    }

    const actionTokens = actionTokensRes[0]?.totalActionTokensUsed || 0;
    const analysisTokens = analysisTokensRes[0]?.totalAnalysisTokensUsed || 0
    const reactionCounts = reactionsRes.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
    }, { neutral: 0, like: 0, dislike: 0 });

    const actionsData = actionsRes.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
    }, {});

    return {
        statusCode: 200,
        message: "Dashboard retrieved",
        data: {
            user: req.user,
            business,
            chatCosts: {
                totalChatTokensUsed,
                costOfInputChatTokens,
                costOfOutputChatTokens,
                OverAllChatCost,
            },
            knowledgeCosts: {
                totalKnowledgeTokensUsed,
                OverAllKnowledgeCost
            },
            OverAllCost: OverAllChatCost + OverAllKnowledgeCost,
            totalChatTokensUsed,
            totalKnowledgeTokensUsed,
            reactionCounts,
            actionsData,
            actionTokens,
            analysisTokens,
            analysis,
            NewAnalysis: NewAnalysis[0],
            locations
        }
    };
});
export const newDashboard = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).select("name logoURL facts sector tagline address description contact analytics");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const lastUpdated = business.analytics?.lastUpdated ?? new Date(0);
    const now = new Date();
    if (now - lastUpdated < 5 * 60 * 1000) return { statusCode: 200, message: "Dashboard retrieved", data: business }
    const [newConversations, newCollections, chatTokens] = await Promise.all([
        Conversation.find({ business: business._id, createdAt: { $gte: lastUpdated } }).select("agent channel createdAt updatedAt"),
        Collection.find({ business: business._id, createdAt: { $gte: lastUpdated } }).select("createdAt updatedAt"),
        Message.aggregate([
            { $match: { business: business._id, createdAt: { $gte: lastUpdated } } },
            {
                $group: {
                    _id: "$responseTokens.model",
                    totalChatTokensUsed: { $sum: "$responseTokens.usage.total_tokens" },
                    inputChatTokensUsed: { $sum: "$responseTokens.usage.input_tokens" },
                    outputChatTokensUsed: { $sum: "$responseTokens.usage.output_tokens" }
                }
            }
        ])
    ])
    const knowledgeTokensRes = await Data.aggregate([
        { $match: { collection: { $in: newCollections.map(ele => ele._id) } } },
        {
            $group: {
                _id: null,
                totalEmbeddingTokens: { $sum: "$metadata.tokenUsage.embeddingTokens" },
                TotalSummarizationInputTokens: { $sum: "$metadata.tokenUsage.summarizationInputTokens" },
                TotalSummarizationOutputTokens: { $sum: "$metadata.tokenUsage.summarizationOutputTokens" },
                TotalSummarizationTotalTokens: { $sum: "$metadata.tokenUsage.summarizationTotalTokens" }
            }
        }
    ])
    let existingKnowledgeCosts = business.analytics.creditsUsage.knowledgeCosts
    for (const ele of knowledgeTokensRes) {
        existingKnowledgeCosts.totalEmbeddingTokens += ele.totalEmbeddingTokens
        existingKnowledgeCosts.TotalSummarizationInputTokens += ele.TotalSummarizationInputTokens
        existingKnowledgeCosts.TotalSummarizationOutputTokens += ele.TotalSummarizationOutputTokens
        existingKnowledgeCosts.TotalSummarizationTotalTokens += ele.TotalSummarizationTotalTokens
        let kt = calculateCost("text-embedding-3-small", ele.totalEmbeddingTokens, 0)
        let st = calculateCost("gpt-4o-mini", ele.TotalSummarizationInputTokens, ele.TotalSummarizationOutputTokens)
        existingKnowledgeCosts.OverAllKnowledgeCost += (kt.totalCost + st.totalCost)
    }
    const AnalysisTokensRes = await Conversation.aggregate([
        { $match: { collection: { $in: newConversations.map(ele => ele._id) } } },
        {
            $group: {
                _id: "$analysisTokens.model",
                TotalAnalysisInputTokens: { $sum: "$analysisTokens.usage.total_tokens" },
                TotalAnalysisOutputTokens: { $sum: "$analysisTokens.usage.output_tokens" },
                TotalAnalysisTotalTokens: { $sum: "$analysisTokens.usage.input_tokens" }
            }
        }
    ])
    let existingAnalysisCosts = business.analytics.creditsUsage.analysisCosts
    for (const ele of AnalysisTokensRes) {
        if (ele._id == null) continue;
        // Add token counts
        existingAnalysisCosts.totalAnalysisTokensUsed += Number(ele.TotalAnalysisTotalTokens);
        // Get computed costs
        const { inputCost, outputCost, totalCost } = calculateCost(ele._id, ele.TotalAnalysisInputTokens, ele.TotalAnalysisOutputTokens) || {};
        // Accumulate cost fields properly
        existingAnalysisCosts.costOfInputAnalysisTokens += inputCost;
        existingAnalysisCosts.costOfOutputAnalysisTokens += outputCost;
        existingAnalysisCosts.OverAllAnalysisCost += totalCost;
    }
    let existingChatCosts = business.analytics.creditsUsage.chatCosts;
    for (const ele of chatTokens) {
        if (ele._id == null) continue;
        // Add token counts
        existingChatCosts.totalChatTokensUsed += Number(ele.totalChatTokensUsed);
        // Get computed costs
        const { inputCost, outputCost, totalCost } = calculateCost(ele._id, ele.inputChatTokensUsed, ele.outputChatTokensUsed) || {};
        // Accumulate cost fields properly
        existingChatCosts.costOfInputChatTokens += inputCost;
        existingChatCosts.costOfOutputChatTokens += outputCost;
        existingChatCosts.OverAllChatCost += totalCost;
    }
    for (const conv of newConversations) business.addEngagementAnalytics(conv.agent, new Date(conv.createdAt), new Date(conv.updatedAt), conv.channel, conv.channelFullDetails)
    business.pruneOldConversationDates();
    business.analytics.lastUpdated = now;
    await business.save();
    return { statusCode: 200, message: "Dashboard retrieved", data: business, misc: { business: business._id, createdAt: { $gte: lastUpdated } } }
});
export const DetailedAnalysis = errorWrapper(async (req, res) => {
    // const { selectedIntents } = req.body;
    const selectedIntents = ["enquiry", "complaint"];
    if (!selectedIntents || selectedIntents.length === 0) return { statusCode: 400, message: "Please provide intents to analyze", data: null }
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }

    const analysis = await Message.aggregate([
        { $match: { business: business._id } },
        { $unwind: "$analysis" },
        { $match: { "analysis.intent": { $in: selectedIntents } } },
        {
            $project: {
                _id: 0,
                intent: "$analysis.intent",
                dataSchema: {
                    $map: {
                        input: "$analysis.dataSchema",
                        as: "schema",
                        in: {
                            label: "$$schema.label",
                            data: "$$schema.data"
                        }
                    }
                }
            }
        }
    ])
    return { statusCode: 200, message: 'queries based on intents', data: analysis }
    // const selectedIntents = ["enquiry", "complaint"];
})
export const editBusiness = errorWrapper(async (req, res) => {
    let business = await Business.findById(req.user.business)
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const { logoURL, facts, sector, tagline, address, description, contact } = req.body
    if (logoURL) business.logoURL = logoURL;
    if (facts) business.facts = facts;
    if (sector) business.sector = sector;
    if (tagline) business.tagline = tagline;
    if (address) business.address = address;
    if (description) business.description = description;
    if (contact) business.contact = contact;
    await business.save();
    return { statusCode: 200, message: "Business updated", data: business }
});
export const raiseTicket = errorWrapper(async (req, res) => {
    const { issueDetails, attachments } = req.body;
    if (!issueDetails) return res.status(400).json({ success: false, message: "Client email, supporter email, and issue details are required." });
    // Generate a well-structured subject, text message, and HTML
    const subject = `🚀 Support Ticket Raised by ${req.user.email}`;
    const message = `Dear Support Team, \n\nA new support ticket has been raised by ${req.user.email}. \n\nIssue Details:\n${issueDetails}\n\nPlease assist as soon as possible.\n\nBest regards,\nSupport System`;
    const htmlMessage = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
                <h2 style="color: #007bff;">
  New Support Ticket Raised by 
  <a href="mailto:${req.user.email}" style="color: #007bff; text-decoration: none;">
    ${req.user.email}
  </a>
</h2>
                <p><strong>Issue Details:</strong></p>
                <blockquote style="background: #f8f9fa; padding: 10px; border-left: 4px solid #007bff;">
                    ${issueDetails}
                </blockquote>
                <p>Please review and assist as soon as possible.</p>
                <p>Best Regards,</p>
                <p><strong>Support System</strong></p>
            </div>
        `;
    const emailData = {
        to: "ankit@onewindow.co,vishnu.teja101.vt@gmail.com",
        subject,
        text: message,
        html: htmlMessage,
        attachments: attachments || [],
    };
    const clientSubject = `✅ Your Support Request Has Been Received`;
    const clientMessage = `Dear ${req.user.name},\n\nWe have received your support request and our team will get back to you shortly.\n\nIssue Details:\n${issueDetails}\n\nIf you need to add any more information, feel free to reply to this email.\n\nBest Regards,\nSupport Team`;
    const clientHtmlMessage = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #28a745;">✅ Support Request Received</h2>
        <p>Dear ${req.user.name},</p>
        <p>We have received your support request and our team will get back to you shortly.</p>
        <p><strong>Issue Details:</strong></p>
        <blockquote style="background: #f8f9fa; padding: 10px; border-left: 4px solid #28a745;">
            ${issueDetails}
        </blockquote>
        <p>If you need to add any more information, feel free to reply to   <a href="mailto:ankit@onewindow.co" style="color: #007bff; text-decoration: none;">
    ankit@onewindow.co
  </a></p>
        <p>Best Regards,</p>
        <p><strong>Support Team</strong></p>
    </div>
`;
    const clientEmailData = {
        to: req.user.email,
        subject: clientSubject,
        text: clientMessage,
        html: clientHtmlMessage,
    };
    await Promise.all([sendMail(emailData), sendMail(clientEmailData)])
    return { statusCode: 200, message: "Ticket raised successfully", data: null }
});
