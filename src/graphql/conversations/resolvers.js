import { fetchConversations } from "./controlers.js";
export const conversationResolvers = {
  Query: {
    conversations: async (_, filters, context, info) => await fetchConversations(_,filters, context, info),
  }
};
