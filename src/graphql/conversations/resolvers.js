import { Conversation } from "../../models/Conversations.js";
import { getSelectFields } from "../../utils/graphqlTools.js";
import graphqlFields from "graphql-fields";
import { AgentModel } from "../../models/Agent.js";
import { Channel } from "../../models/Channels.js";
import { Lead } from "../../models/Leads.js";
import { GraphQLError } from "graphql";
export const conversationResolvers = {
  Query: {
    conversations: async (_, { limit = 10, page = 1, status, id, channelIds, campaignIds, agentIds, leadIds, from, to, priority }, context, info) => {
      const skip = (page - 1) * limit;
      const filter = { business: context.user.business };
      if (id) filter._id = id;
      if (status) filter.status = status;                          // top-level field, not metadata.status
      if (priority) filter.priority = priority;                      // ObjectId ref to Channel
      if (agentIds) filter.agent = { $in: agentIds };
      if (channelIds) filter.channel = { $in: channelIds };
      if (campaignIds) filter.campaign = { $in: campaignIds };
      if (leadIds) filter.lead = { $in: leadIds };
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { rootFields, populateFields } = getSelectFields(requestedFields.data);
      const [conversations, totalDocuments] = await Promise.all([Conversation.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }).select(rootFields), Conversation.countDocuments(filter),]);
      if (populateFields?.agent)
        await AgentModel.populate(conversations, {
          path: "agent",
          select: populateFields.agent,
        });
      if (populateFields?.channel)
        await Channel.populate(conversations, {
          path: "channel",
          select: populateFields.channel,
        });
      if (populateFields?.lead)
        await Lead.populate(conversations, {
          path: "lead",
          select: populateFields.lead,
        });
      return {
        data: conversations,
        metaData: {
          page,
          limit,
          totalPages: Math.ceil(totalDocuments / limit),
          totalDocuments,
        },
      };
    },
  },
  Mutation: {
    updateConversationStatus: async (_, { id, status }, context) => {
      const conversation = await Conversation.findById(id);
      if (!conversation) throw new GraphQLError('Conversation not found');
      await conversation.updateStatus(status);
      return conversation;
    },
    // updateConversationSettings: async (_, { id, settings }, context) => {
    //   const conversation = await Conversation.findById(id);
    //   if (!conversation) throw new GraphQLError('Conversation not found');
    //   return conversation.updateSettings(settings);
    // }
  }
};
