
export const ticketTypeDefs = `#graphql
enum priorityEnum {
low
medium
high
}
enum statusEnum {
pending 
responded 
resolved
}
type contactDetails {
    email: String
    phone: String
    telegramId: String
    whatsappId: String
    instagramId: String
}
type response {
    from: String
    to: String
    cc: String
    subject: String
    bcc: String
    text: String
    html: String
    updatedAt: DateTime
    sentAt: DateTime
    resolvedAt: DateTime
}
input responseInput {
    from: String
    to: String
    cc: String
    subject: String
    bcc: String
    text: String
    html: String
}
type Ticket {
    _id:String
    notifierEmail:String
    issueSummary: String
    channel: ChannelTypeEnum
    priority: priorityEnum
    status: statusEnum
    contactDetails: contactDetails
    response: response
    createdAt:DateTime
    updatedAt:DateTime
}
type Query {
    fetchTickets(notifierEmail: String channel: ChannelTypeEnum priority: priorityEnum status: statusEnum id:ID): [Ticket] @requireScope(scope: "ticket:read")
}

type Mutation {
  updateTicket(id: ID! input: responseInput!): Ticket @requireScope(scope: "ticket:update") @requireBusinessAccess
  deleteTicket(id: ID!): Boolean @requireScope(scope: "ticket:delete") @requireBusinessAccess
}

`;