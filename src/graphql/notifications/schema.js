export const notificationTypeDefs = `#graphql
enum statusEnum {
unseen
seen
}
input statusUpdateInput {
    id: ID!
    status: statusEnum
}
type notification {
    _id:ID
    head: String
    body: String
    type: String
    attachments: JSON
    status: statusEnum
    createdAt:DateTime
    updatedAt:DateTime
}
type Query {
    fetchNotifications: [notification] @requireScope(scope: "notification:read")
}
type Mutation {
  updateNotifications(statusUpdateInput:statusUpdateInput!): notification @requireScope(scope: "notification:update") @requireBusinessAccess
  deleteNotifications(id: ID!): Boolean @requireScope(scope: "notification:delete") @requireBusinessAccess
}
`;