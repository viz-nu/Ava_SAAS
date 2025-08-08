export const channelTypeDefs = `#graphql
# Base Interface for all channels

type Query {
  getChannels( _id:ID, type:ChannelTypeEnum, status:String ): [Channel] @requireScope(scope: "channel:read")
}
input ChannelInput {
name:String
type:ChannelTypeEnum!
config:JSON
systemPrompt: String
isPublic:Boolean
UIElements:JSON
}
type Mutation {
  createChannel(input: ChannelInput!): Channel  @requireScope(scope: "channel:create") @requireBusinessAccess
  updateChannel(id: ID!, input: ChannelInput!): Channel @requireScope(scope: "channel:update") @requireBusinessAccess
  deleteChannel(id: ID!): Boolean @requireScope(scope: "channel:delete") @requireBusinessAccess
}
`; 