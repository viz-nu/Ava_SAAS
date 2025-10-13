import graphqlFields from 'graphql-fields';
import { AgentModel } from '../../models/Agent.js';
import { Collection } from '../../models/Collection.js';
import { Action } from '../../models/Action.js';
import { flattenFields } from '../../utils/graphqlTools.js';
import { openai } from '../../utils/openai.js';
import { Channel } from '../../models/Channels.js';
import { Business } from '../../models/Business.js';
import { User } from '../../models/User.js';
import axios from 'axios';
export const agentResolvers = {
    Query: {
        agents: async (_, { limit = 10, isPublic, isFeatured, id }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (isPublic !== undefined) filter.isPublic = isPublic;
            if (isFeatured !== undefined) filter.isFeatured = isFeatured;
            if (id !== undefined) filter._id = id;
            const agents = await AgentModel.find(filter).select(projection).limit(limit).sort({ createdAt: -1 });
            await Business.populate(agents, { path: 'business', select: nested.business });
            await User.populate(agents, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(agents, { path: 'channels', select: nested.channels });
            await Collection.populate(agents, { path: 'collections', select: nested.collections });
            await Action.populate(agents, { path: 'actions', select: nested.actions });
            return agents;
        }
        ,
        ephemeralToken: async (_, { id }, context, info) => {
            const filter = {};
            filter.business = context.user.business;
            filter._id = id;
            const agentDetails = await AgentModel.findOne(filter).select({ personalInfo: 1 });
            const { model, provider, voice } = agentDetails.personalInfo.VoiceAgentSessionConfig;
            if (provider !== "openai") throw new GraphQLError("Invalid provider", { extensions: { code: "INVALID_PROVIDER" } });
            const { data } = await axios.post(
                "https://api.openai.com/v1/realtime/client_secrets",
                { session: { type: "realtime", model: model, audio: { output: { voice: voice, } }, }, },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.OPEN_API_KEY}`,
                        "Content-Type": "application/json",
                    }
                },
            );
            console.log("secretData:", JSON.stringify(data, null, 2));
            return data
        }
    },
    Mutation: {
        createAgent: async (_, { agent }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            let { appearance, personalInfo, actions = [], channels = [], collections = [], isPublic, isFeatured, analysisMetrics } = agent;
            const [foundChannels, foundCollections, foundActions] = await Promise.all([
                Promise.all(channels.map(id => Channel.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(collections.map(id => Collection.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(actions.map(id => Action.findOne({ _id: id, business: context.user.business }, "_id"))),
            ]);
            if (foundChannels.length !== channels.length) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            if (foundCollections.length !== collections.length) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            if (foundActions.length !== actions.length) throw new GraphQLError("Action not found", { extensions: { code: "ACTION_NOT_FOUND" } });
            const newAgent = await AgentModel.create({ appearance, personalInfo, channels, actions, collections, business: context.user.business, createdBy: context.user._id, isPublic, isFeatured, analysisMetrics })
            await Business.populate(newAgent, { path: 'business', select: nested.business });
            await User.populate(newAgent, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(newAgent, { path: 'channels', select: nested.channels });
            await Collection.populate(newAgent, { path: 'collections', select: nested.collections });
            await Action.populate(newAgent, { path: 'actions', select: nested.actions });
            return newAgent;
        },
        updateAgent: async (_, { id, agent }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            let { actions = [], channels = [], collections = [] } = agent;
            const [foundChannels, foundCollections, foundActions] = await Promise.all([
                Promise.all(channels.map(id => Channel.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(collections.map(id => Collection.findOne({ _id: id, business: context.user.business }, "_id"))),
                Promise.all(actions.map(id => Action.findOne({ _id: id, business: context.user.business }, "_id"))),
            ]);
            if (foundChannels.length !== channels.length) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            if (foundCollections.length !== collections.length) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            if (foundActions.length !== actions.length) throw new GraphQLError("Action not found", { extensions: { code: "ACTION_NOT_FOUND" } });
            const updatedAgent = await AgentModel
                .findByIdAndUpdate(id, { ...agent, updatedAt: new Date() }, { new: true })
                .select(projection);
            await Business.populate(updatedAgent, { path: 'business', select: nested.business });
            await User.populate(updatedAgent, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(updatedAgent, { path: 'channels', select: nested.channels });
            await Collection.populate(updatedAgent, { path: 'collections', select: nested.collections });
            await Action.populate(updatedAgent, { path: 'actions', select: nested.actions });
            return updatedAgent;
        },
        deleteAgent: async (_, { id }, context) => {
            const result = await AgentModel.findByIdAndDelete(id);
            return !!result;
        },
        generatePrompt: async (_, { prompt }, context) => {
            const systemInstruction = `You are an expert prompt engineer. Your job is to take a rough or draft input describing an AI assistant and generate a polished, detailed, and optimized system prompt. The final output should clearly define the assistant's name, role, goals, tone, limitations, language, audience, response style, and fallback behavior in a structured and professional format.`;
            const aiResponse = await openai.chat.completions.create({
                model: "gpt-4.1-mini-2025-04-14",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: JSON.stringify(prompt) }
                ],
                // max_tokens: 500,
            });
            // note usage
            console.log("prompt gen response", JSON.stringify(aiResponse, null, 2));
            return aiResponse.choices[0].message.content.trim();
        }
    }
}; 