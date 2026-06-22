import { Conversation } from "../../models/Conversations.js";
import { getSelectFields } from "../../utils/graphqlTools.js";
import graphqlFields from "graphql-fields";
import { AgentModel } from "../../models/Agent.js";
import { Channel } from "../../models/Channels.js";
import { Campaign } from "../../models/Campaign.js";
import { Lead } from "../../models/Leads.js";
import { GraphQLError } from "graphql";
import { Providers } from "../../models/Providers.js";
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
      if (populateFields?.campaign)
        await Campaign.populate(conversations, {
          path: "campaign",
          select: populateFields.campaign,
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
    createConversation: async (_, { input }, context) => {
      const { leadId, channelId, force = false } = input;
      const lead = await Lead.findById(leadId);
      if (!lead) throw new GraphQLError("Lead not found", { extensions: { code: "NOT_FOUND" } });
      const channel = await Channel.findById(channelId);
      if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "NOT_FOUND" } });
      await channel.populate('apiAuthenticator');
      await Providers.populate(channel, { path: 'apiAuthenticator.provider', select: 'name' });
      let externalConversationIds = null, primaryExternalConversationId = null;
      switch (channel.apiAuthenticator.provider.name) {
        case "Whatsapp":
          externalConversationIds = lead.contactDetails.whatsapp?.map(entry => {
            if (entry.isPrimary) primaryExternalConversationId = entry.handle;
            return entry.handle
          });
          if (!primaryExternalConversationId) primaryExternalConversationId = externalConversationIds[0];
          break;
      }
      const conversations = await Conversation.find({
        business: context.user.business,
        channel: channelId,
        lead: leadId,
        externalConversationId: { $in: externalConversationIds },
        status: { $nin: ["archived", "spam", "closed"] }
      });
      if (conversations.length > 0 && !force) return { existingConversations: conversations, newConversation: null };
      if (!primaryExternalConversationId) throw new GraphQLError("cannot create conversation for this lead using this channel", { extensions: { code: "INVALID_INPUT" } });
      const conversation = await Conversation.create({
        business: context.user.business,
        channel: channelId,
        lead: leadId,
        externalConversationId: primaryExternalConversationId,
        status: "open"
      });
      return { newConversation: conversation, existingConversations: null };
    },
  },
};
