import graphqlFields from 'graphql-fields';
import { AgentModel } from '../../models/Agent.js';
import { Collection } from '../../models/Collection.js';
import { Action } from '../../models/Action.js';
import { flattenFields } from '../../utils/graphqlTools.js';
import { openai } from '../../utils/openai.js';
import { Channel } from '../../models/Channels.js';
export const agentResolvers = {
    Query: {
        agents: async (_, { limit = 10, isPublic, isFeatured, id }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (isPublic !== undefined) filter.isPublic = isPublic;
            if (isFeatured !== undefined) filter.isFeatured = isFeatured;
            if (id !== undefined) filter._id = id;
            return await AgentModel.find(filter)
                .populate('business')
                .populate('createdBy')
                .populate('channels')
                .populate('collections')
                .select(projection).limit(limit).sort({ createdAt: -1 });
        }
    },
    Mutation: {
        createAgent: async (_, { agent }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            let { appearance, personalInfo, actions = [], channels = [], collections = [], isPublic, isFeatured, analysisMetrics = {
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
            } } = agent;
            const [foundChannels, foundCollections, foundActions] = await Promise.all([
                Promise.all(channels.map(id => Channel.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(collections.map(id => Collection.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(actions.map(id => Action.findOne({ _id: id, business: context.user.business }, "_id"))),
            ]);
            if (foundChannels.length !== channels.length) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            if (foundCollections.length !== collections.length) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            if (foundActions.length !== actions.length) throw new GraphQLError("Action not found", { extensions: { code: "ACTION_NOT_FOUND" } });
            return await AgentModel
                .create({ appearance, personalInfo, channels, actions, collections, business: context.user.business, createdBy: context.user._id, isPublic, isFeatured, analysisMetrics })
                .populate('business')
                .populate('createdBy')
                .populate('channels')
                .populate('collections')
                .populate('actions')
                .select(projection);
        },

        updateAgent: async (_, { id, agent }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            let { appearance, personalInfo, actions = [], channels = [], collections = [], isPublic, isFeatured, analysisMetrics = {
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
            } } = agent;
            const [foundChannels, foundCollections, foundActions] = await Promise.all([
                Promise.all(channels.map(id => Channel.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(collections.map(id => Collection.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(actions.map(id => Action.findOne({ _id: id, business: context.user.business }, "_id"))),
            ]);
            if (foundChannels.length !== channels.length) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            if (foundCollections.length !== collections.length) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            if (foundActions.length !== actions.length) throw new GraphQLError("Action not found", { extensions: { code: "ACTION_NOT_FOUND" } });
            return await AgentModel
                .findByIdAndUpdate(id, { ...agent, updatedAt: new Date() }, { new: true })
                .populate('business')
                .populate('createdBy')
                .populate('channels')
                .populate('collections')
                .populate('actions')
                .select(projection);
        },

        deleteAgent: async (_, { id }, context) => {
            const result = await AgentModel.findByIdAndDelete(id);
            return !!result;
        },

        generatePrompt: async (_, { prompt }, context) => {
            const systemInstruction = `You are an expert prompt engineer. Your job is to take a rough or draft input describing an AI assistant and generate a polished, detailed, and optimized system prompt. The final output should clearly define the assistant's name, role, goals, tone, limitations, language, audience, response style, and fallback behavior in a structured and professional format.`;
            const aiResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: JSON.stringify(prompt) }
                ],
                max_tokens: 500,
            });
            // note usage
            console.log("prompt gen response", JSON.stringify(aiResponse, null, 2));
            return aiResponse.choices[0].message.content.trim();
        }
    }
}; 