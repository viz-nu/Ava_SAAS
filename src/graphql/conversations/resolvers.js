import { Conversation } from "../../models/Conversations.js";
import { flattenFields } from "../../utils/graphqlTools.js";
import graphqlFields from "graphql-fields";
import { AgentModel } from "../../models/Agent.js";
export const conversationResolvers = {
  Query: {
    conversations: async (_, { limit = 10, page = 1, status, _id, channelIds, campaignIds, agentId, channel, from, to, userLocation, disconnectReason }, context, info) => {
      // add pagination support
      const skip = (page - 1) * limit;
      const filter = { business: context.user.business };
      if (_id) filter._id = _id;
      if (status) filter["metadata.status"] = status;
      if (channel) filter.channel = channel;
      if (agentId) filter.agent = agentId;
      if (userLocation) filter["metadata.userLocation"] = userLocation;
      if (disconnectReason) filter["metadata.sockets.disconnectReason"] = disconnectReason;
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }
      if (channelIds) filter.channelFullDetails = { $in: channelIds };
      if (campaignIds) filter.campaign = { $in: campaignIds };
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { projection, nested } = flattenFields(requestedFields);
      const [conversations, totalDocuments] = await Promise.all([
        Conversation.find(filter).limit(limit).skip(skip).sort({ createdAt: -1 }),
        Conversation.countDocuments(filter)
      ]);
      // await Business.populate(conversations, { path: 'business', select: nested.business });
      await AgentModel.populate(conversations, { path: 'agent', select: nested.agent });
      // await Channel.populate(conversations, { path: 'channel', select: nested.channel });
      // await Campaign.populate(conversations, { path: 'campaign', select: nested.campaign });
      return { data: conversations, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
    }
  }
};

