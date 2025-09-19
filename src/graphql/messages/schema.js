export const messageTypeDefs = `#graphql
enum reactionEnum {
    neutral
    like
    dislike
}
"""A message in a conversation"""
type message {
    _id: ID!
    conversationId: Conversation
    business: Business
    query: String
    response: String
    reaction: reactionEnum
    createdAt: DateTime
    updatedAt: DateTime
}
type Query {
    fetchMessages(conversationId: ID!, limit: Int page: Int): [message] @requireScope(scope: "conversation:read") @requireBusinessAccess
}         
`;