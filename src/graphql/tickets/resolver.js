import graphqlFields from "graphql-fields";
import { Ticket } from "../../models/Tickets.js";
import { flattenFields } from "../../utils/graphqlTools.js";

// type Mutation {
//     updateTicket(id: ID! input: response!): Ticket @requireScope(scope: "ticket:update") @requireBusinessAccess
// deleteTicket(id: ID!): Boolean @requireScope(scope: "ticket:delete") @requireBusinessAccess
// }
export const ticketResolvers = {
    Query: {
        async fetchTickets(_, { notifierEmail, channel, priority, status, id }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            if (notifierEmail) filter.notifierEmail = notifierEmail;
            if (status) filter.status = status;
            if (channel) filter.channel = id;
            if (priority) filter.priority = priority;
            return await Ticket.find(filter).select(projection);
        },
    },
    Mutation: {
       async updateTicket(_, { input, id }, context, info){ return {}},
       async deleteTicket(_, { id }, context, info){ return {}}
    },

};