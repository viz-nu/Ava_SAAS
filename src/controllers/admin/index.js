import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { Data } from "../../models/Data.js";
import { Message } from "../../models/Messages.js";
import { sendMail } from "../../utils/sendEmail.js";
import { Action } from "../../models/Action.js";
import { analyzeQueries } from "../../utils/nlp.js";
import { Agent } from "../../models/Agent.js";
export const Dashboard = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate("agents members documents").select("collections name logoURL facts sector tagline address description contact");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const aggregationQueries = [
        business.collections.length > 0
            ? Data.aggregate([
                { $match: { collection: { $in: business.collections } } },
                { $group: { _id: null, totalKnowledgeTokensUsed: { $sum: "$metadata.tokensUsed" } } }
            ])
            : Promise.resolve([{ totalKnowledgeTokensUsed: 0 }]),
        Message.aggregate([
            { $match: { business: business._id } },
            { $group: { _id: null, totalChatTokensUsed: { $sum: "$responseTokens.usage.total_tokens" } } }
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
        ])
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
    ] = await Promise.all(aggregationQueries);
    const totalKnowledgeTokensUsed = knowledgeTokensRes[0]?.totalKnowledgeTokensUsed || 0;
    const totalChatTokensUsed = chatTokensRes[0]?.totalChatTokensUsed || 0;
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
            totalKnowledgeTokensUsed,
            totalChatTokensUsed,
            reactionCounts,
            actionsData,
            actionTokens,
            analysisTokens,
            analysis,
            NewAnalysis: NewAnalysis[0]
        }
    };
});
export const geoLocationsData = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate({ path: "agents", select: "personalInfo.name" });
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return { statusCode: 200, message: "Business", data: business.agents };

})
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
export const createActions = errorWrapper(async (req, res) => {
    const { intent, workingData } = req.body
    if (!intent || !workingData) return { statusCode: 404, message: "intend or workingData not found", data: null }
    const business = await Business.findById(req.user.business)
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const action = await Action.create({ business: business._id, ...req.body })
    return { statusCode: 201, message: "Action created successfully", data: action }
});
export const getActions = errorWrapper(async (req, res) => {
    const actions = await Action.find({ business: req.user.business });
    return { statusCode: 200, message: "Actions fetched successfully", data: actions }
});
export const getActionById = errorWrapper(async (req, res) => {
    const action = await Action.findOne({ _id: req.params.id, business: req.user.business });
    if (!action) return res.status(404).json({ message: "Action not found" });
    return { statusCode: 200, message: "Action fetched successfully", data: action }
});
export const updateAction = errorWrapper(async (req, res) => {
    const action = await Action.findOneAndUpdate({ _id: req.params.id, business: req.user.business }, { ...req.body }, { new: true });
    if (!action) return res.status(404).json({ message: "Action not found" });
    return { statusCode: 200, message: "Action updated successfully", data: action }
});
export const deleteAction = errorWrapper(async (req, res) => {
    const action = await Action.findById(req.params.id);
    if (!action) return res.status(404).json({ message: "Action not found" });
    const [deletedAction, updatedBusiness, updatedAgents] = await Promise.all([
        Action.findByIdAndDelete(req.params.id),
        Business.updateOne({ actions: req.params.id }, { $pull: { actions: req.params.id } }),
        Agent.updateMany({ actions: req.params.id }, { $pull: { actions: req.params.id } })
    ]);
    return { statusCode: 200, message: "Action deleted successfully", data: { deletedAction, updatedBusiness, updatedAgents } }
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
