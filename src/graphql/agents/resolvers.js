import { AgentModel } from '../../models/Agent.js';
import { Business } from '../../models/Business.js';
import { User } from '../../models/User.js';

export const agentResolvers = {
    Query: {
        agents: async (_, { limit = 10, isPublic, isFeatured, business }, context) => {
            const filter = {};

            // Filter by business (user's business or specified business)
            if (business) {
                filter.business = business;
            } else if (context.user.business) {
                filter.business = context.user.business;
            }

            if (isPublic !== undefined) filter.isPublic = isPublic;
            if (isFeatured !== undefined) filter.isFeatured = isFeatured;

            return await AgentModel.find(filter)
                .populate('business')
                .populate('createdBy')
                .limit(limit)
                .sort({ createdAt: -1 });
        },

        agent: async (_, { id }, context) => {
            return await AgentModel.findById(id)
                .populate('business')
                .populate('createdBy');
        },

        publicAgents: async (_, { limit = 10, isFeatured }) => {
            const filter = { isPublic: true };
            if (isFeatured !== undefined) filter.isFeatured = isFeatured;

            return await AgentModel.find(filter)
                .populate('business')
                .limit(limit)
                .sort({ createdAt: -1 });
        },

        featuredAgents: async (_, { limit = 10 }) => {
            return await AgentModel.find({ isFeatured: true, isPublic: true })
                .populate('business')
                .limit(limit)
                .sort({ createdAt: -1 });
        }
    },

    Mutation: {
        createAgent: async (_, { agent }, context) => {
            const newAgent = new AgentModel({
                ...agent,
                business: agent.business || context.user.business,
                createdBy: context.user._id
            });

            return await newAgent.save();
        },

        updateAgent: async (_, { id, agent }, context) => {
            return await AgentModel.findByIdAndUpdate(
                id,
                { ...agent, updatedAt: new Date() },
                { new: true }
            ).populate('business').populate('createdBy');
        },

        deleteAgent: async (_, { id }, context) => {
            const result = await AgentModel.findByIdAndDelete(id);
            return !!result;
        },

        generatePrompt: async (_, { prompt, agentId }, context) => {
            // This would integrate with your prompt generation service
            return `Generated prompt for agent ${agentId}: ${prompt}`;
        },

        deployAgent: async (_, { agentId, channelId }, context) => {
            // This would integrate with your deployment service
            return true;
        },

        testAgent: async (_, { agentId, message }, context) => {
            // This would integrate with your agent testing service
            return `Test response from agent ${agentId}: ${message}`;
        }
    },

    Agent: {
        business: async (parent) => {
            if (parent.business) {
                return await Business.findById(parent.business);
            }
            return null;
        },

        createdBy: async (parent) => {
            if (parent.createdBy) {
                return await User.findById(parent.createdBy).select('-password');
            }
            return null;
        }
    }
}; 