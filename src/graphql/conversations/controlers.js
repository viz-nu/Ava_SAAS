import graphqlFields from "graphql-fields";
import { Business } from "../../models/Business.js";
import { Conversation } from "../../models/Conversations.js";
function flattenFields(fields, prefix = '', result = {}) {
    for (const key in fields) {
        if (key === '__typename') continue; // Apollo adds this; ignore it

        const path = prefix ? `${prefix}.${key}` : key;
        const value = fields[key];

        if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
            result[path] = 1;
        } else {
            flattenFields(value, path, result);
        }
    }
    return result;
}
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