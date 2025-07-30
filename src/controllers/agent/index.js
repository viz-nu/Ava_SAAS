import { errorWrapper } from '../../middleware/errorWrapper.js';
import { Action } from '../../models/Action.js';
import { AgentModel } from '../../models/Agent.js';
import { Business } from '../../models/Business.js';
import { Channel } from '../../models/Channels.js';
import { Collection } from '../../models/Collection.js';
import { agentSchema } from '../../Schema/index.js';
import { openai } from '../../utils/openai.js';
export const createAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    let { appearance, personalInfo, actions = [], channels = [], collections = [], isPublic, analysisMetrics = {
        "type": "object",
        "properties": {
            "isLead": {
                "type": "boolean",
                "description": "Whether the contact is already a lead (true) or just a visitor (false).",
                "default": false
            },
            "qualification": {
                "type": "string",
                "description": "Qualification bucket for the contact.",
                "enum": ["hot", "warm", "cold", "unqualified"]  // replace with your QualifyEnum values
            },
            "language": {
                "type": "string",
                "description": "ISO‑639‑1 language code (e.g. \"en\", \"fr\").",
                "default": "en"
            },
            "role": {
                "type": "string",
                "description": "Role the user plays when interacting with the organisation (e.g. \"student\", \"parent\", \"prospect\", \"partner\")."
            },
            "score": {
                "type": "number",
                "description": "Internal lead‑scoring metric (0‑100).",
                "minimum": 0,
                "maximum": 100
            },
            "interestClusters": {
                "type": "array",
                "description": "Tags or topical clusters the user has shown interest in.",
                "items": { "type": "string" }
            }
        },
        "additionalProperties": false,
        "required": ["interestClusters", "score", "role", "language", "qualification", "isLead"]
    } } = req.body
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    for (const id of channels) {
        const channel = await Channel.findOne({ _id: id, business: req.user.business });
        if (!channel) return { statusCode: 404, message: "channel not found", data: null }
    }
    for (const id of collections) {
        const collection = await Collection.findOne({ _id: id, business: req.user.business });
        if (!collection) return { statusCode: 404, message: "collection not found", data: null }
    }
    for (const id of actions) {
        const action = await Action.findOne({ _id: id, business: req.user.business });
        if (!action) return { statusCode: 404, message: "action not found", data: null }
    }
    const agent = await AgentModel.create({ appearance, personalInfo, channels, actions, collections, business: business._id, createdBy: req.user._id, isPublic, analysisMetrics, facets: Object.keys(analysisMetrics?.properties) });
    return { statusCode: 201, message: "New agent added", data: agent };
});
export const getAllAgents = errorWrapper(async (req, res) => {
    let filter = {
 $or: [   { business: req.user.business },  { isPublic: true }   ] }
    if (req.params.id) filter._id = req.params.id
    const agents = await AgentModel.find(filter);
    return { statusCode: 200, message: "Agents retrieved", data: agents }
});
export const updateAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    const agent = await AgentModel.findOne({ _id: req.params.id, business: req.user.business });
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    const { appearance, personalInfo, actions, channels, collections, isPublic } = req.body
    if (channels !== undefined && channels.length > 0) {
        for (const id of channels) {
            const channel = await Channel.findOne({ _id: id, business: req.user.business });
            if (!channel) return { statusCode: 404, message: "channel not found", data: null }
        }
        agent.channels = channels;
    }
    if (collections !== undefined && collections.length > 0) {
        for (const id of collections) {
            const collection = await Collection.findOne({ _id: id, business: req.user.business });
            if (!collection) return { statusCode: 404, message: "collection not found", data: null }
        }
        agent.collections = collections;
    }
    if (actions !== undefined && actions.length > 0) {
        for (const id of actions) {
            const action = await Action.findOne({ _id: id, business: req.user.business });
            if (!action) return { statusCode: 404, message: "action not found", data: null }
        }
        agent.actions = actions;
    }
    if (appearance !== undefined) agent.appearance = appearance;
    if (isPublic !== undefined) agent.isPublic = isPublic;
    if (personalInfo) {
        const { name, systemPrompt, role, temperature, model, welcomeMessage, quickQuestions, facts, noDataMail } = personalInfo
        if (noDataMail) agent.personalInfo.noDataMail = noDataMail;
        if (name) agent.personalInfo.name = name;
        if (systemPrompt) agent.personalInfo.systemPrompt = systemPrompt;
        if (temperature) agent.personalInfo.temperature = temperature;
        if (model) agent.personalInfo.model = model;
        if (role) agent.personalInfo.role = role;
        if (welcomeMessage) agent.personalInfo.welcomeMessage = welcomeMessage;
        if (quickQuestions) agent.personalInfo.quickQuestions = quickQuestions;
        if (facts) agent.personalInfo.facts = facts;
    }
    await agent.save();
    return { statusCode: 200, message: "Agent updated", data: agent };
});
export const deleteAgent = errorWrapper(async (req, res) => {
    const agent = await AgentModel.findOne({ _id: req.params.id, business: req.user.business });
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    await AgentModel.findByIdAndDelete(req.params.id)
    return { statusCode: 200, message: "Agent deleted successfully" };
});
export const promptGenerator = errorWrapper(async (req, res) => {
    const { prompt } = req.body;
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const systemInstruction = `You are an expert prompt engineer. Your job is to take a rough or draft input describing an AI assistant and generate a polished, detailed, and optimized system prompt. The final output should clearly define the assistant's name, role, goals, tone, limitations, language, audience, response style, and fallback behavior in a structured and professional format.`;
    const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: JSON.stringify(prompt) }
        ],
        max_tokens: 500,
    });
    return { statusCode: 200, message: "Prompt generated successfully", data: aiResponse.choices[0].message.content.trim() };
});