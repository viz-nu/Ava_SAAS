import graphqlFields from "graphql-fields";
import { Business } from "../../models/Business.js";
import { Conversation } from "../../models/Conversations.js";
import { flattenFields } from "../../utils/graphqlTools.js"
export const fetchConversations = async (_, filters, context, info) => {
    const { limit = 10, status, _id, agentId, channel, from, to, geoLocation, disconnectReason } = filters
    const business = await Business.findById(context.user.business);
    if (!business) return []
    const filter = { business: business._id };
    if (_id) filter._id = _id;
    if (status) filter.status = status;
    if (channel) filter.channel = channel;
    if (agentId) filter.agent = agentId;
    if (geoLocation) filter.geoLocation = geoLocation;
    if (disconnectReason) filter["sockets.disconnectReason"] = disconnectReason;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }
    const requestedFields = graphqlFields(info, {}, { processArguments: false });
    const projection = flattenFields(requestedFields);
    const conversations = await Conversation.find(filter).select(projection).limit(limit).sort({ createdAt: -1 });
    return conversations;
}