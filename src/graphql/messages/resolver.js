import { Message } from "../../models/Messages.js";
import { Business } from "../../models/Business.js";
import graphqlFields from "graphql-fields";
import { flattenFields } from "../../utils/graphqlTools.js";

export const messageResolvers = {
    Query: {
        fetchMessages: async (_, { conversationId, limit = 10, page = 1 }, context, info) => {
            const filter = { business: context.user.business };
            if (conversationId) filter.conversationId = conversationId;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const messages = await Message.find(filter).select(projection).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            await Business.populate(messages, { path: 'business', select: nested.business });
            return messages;
        }
    }
}