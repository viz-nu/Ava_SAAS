import { errorWrapper } from '../../middleware/errorWrapper.js';
import { Agent } from '../../models/Agent.js';
import { Business } from '../../models/Business.js';
import { Collection } from '../../models/Collection.js';
import { agentSchema } from '../../Schema/index.js';

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
    const agent = await Agent.create({ collections, appearance, personalInfo, actions, business: business._id, createdBy: req.user._id });
    business.agents.push(agent._id)
    await business.save()
    return { statusCode: 201, message: "New agent added", data: agent };
});


export const getAllAgents = errorWrapper(async () => {
    const agents = await Agent.find().populate('collections business createdBy');
    return { statusCode: 200, message: "Agents retrieved", data: agents };
});

export const getAgentById = errorWrapper(async (req) => {
    const agent = await Agent.findById(req.params.id).populate('collections business createdBy');
    if (!agent) throw new Error('Agent not found');
    return { statusCode: 200, message: "Agent retrieved", data: agent };
});

export const updateAgent = errorWrapper(async (req) => {
    await updateSchema.validate(req.body);
    const agent = await Agent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!agent) throw new Error('Agent not found');
    return { statusCode: 200, message: "Agent updated", data: agent };
});

export const deleteAgent = errorWrapper(async (req) => {
    const agent = await Agent.findByIdAndDelete(req.params.id);
    if (!agent) throw new Error('Agent not found');
    return { statusCode: 200, message: "Agent deleted successfully" };
});

