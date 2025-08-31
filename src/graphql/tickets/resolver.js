import graphqlFields from "graphql-fields";
import { Ticket } from "../../models/Tickets.js";
import { flattenFields } from "../../utils/graphqlTools.js";
import { Business } from "../../models/Business.js";
export const ticketResolvers = {
    Query: {
        async fetchTickets(_, { notifierEmail, channel, priority, status, id }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            if (notifierEmail) filter.notifierEmail = notifierEmail;
            if (status) filter.status = status;
            if (channel) filter.channel = id;
            if (priority) filter.priority = priority;
            const tickets = await Ticket.find(filter).select(projection).sort({ createdAt: -1 });
            Business.populate(tickets, { path: "business", select: nested })
            return tickets
        }
    },
    Mutation: {
        async updateTicket(_, { input, id }, context, info) { return {} },
        async deleteTicket(_, { id }, context, info) { return true }
    }
};