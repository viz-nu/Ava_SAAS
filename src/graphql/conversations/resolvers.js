import { Conversation } from "../../models/Conversations.js";
import { flattenFields } from "../../utils/graphqlTools.js";
import graphqlFields from "graphql-fields";

export const conversationResolvers = {
  Query: {
    conversations: async (_, { limit = 10, status, _id, agentId, channel, from, to, userLocation, disconnectReason }, context, info) => {
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
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { projection, nested } = flattenFields(requestedFields);
      const conversations = await Conversation.find(filter).select(projection).limit(limit).sort({ createdAt: -1 });
      return conversations;
    }
  },
  Mutation: {
    updateConversationAnalysis: async (_, { conversationIds }, context, info) => {
      try {
        const conversations = await Conversation.find({
          _id: {
            $in: conversationIds
          }
        });
        await Promise.all(conversations.map(async (conversation) => await conversation.updateAnalytics()));
        return conversations;
      } catch (error) {
        console.error(error);
      }

    },
  }
};

