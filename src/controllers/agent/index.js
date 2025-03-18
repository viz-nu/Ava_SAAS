import { errorWrapper } from '../../middleware/errorWrapper.js';
import { Action } from '../../models/Action.js';
import { Agent } from '../../models/Agent.js';
import { Business } from '../../models/Business.js';
import { Collection } from '../../models/Collection.js';
import { agentSchema } from '../../Schema/index.js';
import { openai } from '../../utils/openai.js';
export const createAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    const { collections, appearance, personalInfo, actions } = req.body
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    for (const id of collections) {
        const collection = await Collection.findById(id);
        if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
        if (collection.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this collection", data: { collectionId: id } }
    }
    for (const id of actions) {
        const action = await Action.findById(id);
        if (!action) return { statusCode: 404, message: "action not found", data: null }
        if (action.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this action", data: { collectionId: id } }
    }
    let assistant = await openai.beta.assistants.create({ name: personalInfo.name || 'Custom Assistant', instructions: personalInfo.systemPrompt || "", model: personalInfo.model || "gpt-4o-mini-2024-07-18", temperature: personalInfo.temperature || 1 });
    personalInfo.assistantId = assistant.id;
    const agent = await Agent.create({ collections, appearance, personalInfo, actions, business: business._id, createdBy: req.user._id });
    business.agents.push(agent._id)
    await business.save()
    return { statusCode: 201, message: "New agent added", data: agent };
});
export const getAllAgents = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate("agents");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return { statusCode: 200, message: "Agents retrieved", data: business.agents }
});
export const getAgentById = errorWrapper(async (req, res) => {
    const agent = await Agent.findById(req.params.id).populate('collections business createdBy');
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    const business = await Business.findById(req.user.business);
    if (!business || !business.agents.includes(agent._id)) return { statusCode: 403, message: "Unauthorized", data: null }
    return { statusCode: 200, message: "Agent retrieved", data: agent };
});
export const updateAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    const [business, agent] = await Promise.all([Business.findById(req.user.business), Agent.findById(req.params.id)]);
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.agents.includes(req.params.id)) return { statusCode: 403, message: "Unauthorized", data: null }
    const { collections, appearance, personalInfo, actions } = req.body
    if (collections) {
        for (const id of collections) {
            const collection = await Collection.findById(id);
            if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
            if (collection.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this collection", data: { collectionId: id } }
        }
        agent.collections = collections;
    }
    if (actions) {
        for (const id of actions) {
            const action = await Action.findById(id);
            if (!action) return { statusCode: 404, message: "action not found", data: null }
            if (action.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this action", data: { actionId: id } }
        }
        agent.actions = actions;
    }
    if (appearance) agent.appearance = appearance;
    if (personalInfo) {
        const { name, systemPrompt, role, temperature, model, welcomeMessage, quickQuestions, facts } = personalInfo
        if (name) agent.personalInfo.name = name;
        if (systemPrompt) agent.personalInfo.systemPrompt = systemPrompt;
        if (temperature) agent.personalInfo.temperature = temperature;
        if (model) agent.personalInfo.model = model;
        if (role) agent.personalInfo.role = role;
        if (welcomeMessage) agent.personalInfo.welcomeMessage = welcomeMessage;
        if (quickQuestions) agent.personalInfo.quickQuestions = quickQuestions;
        if (facts) agent.personalInfo.facts = facts;
        if (name || systemPrompt || temperature || model) await openai.beta.assistants.update(personalInfo.assistantId, { name: personalInfo.name, instructions: personalInfo.systemPrompt || "", model: personalInfo.model || "gpt-4o-mini-2024-07-18", temperature: personalInfo.temperature || 1 });
    }
    await agent.save();
    return { statusCode: 200, message: "Agent updated", data: agent };
});
export const deleteAgent = errorWrapper(async (req, res) => {
    // Find the collection by ID
    const agent = await Agent.findById(req.params.id);
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    // Ensure that the collection belongs to the user's business
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.agents.includes(req.params.id)) return { statusCode: 404, message: "You are not authorized to delete this collection", data: null }
    await Promise.all([
        openai.beta.assistants.del(agent.personalInfo.assistantId),
        Agent.findByIdAndDelete(req.params.id),
        Business.updateMany({ agents: req.params.id }, { $pull: { agents: req.params.id } })
    ])
    return { statusCode: 200, message: "Agent deleted successfully" };
});


