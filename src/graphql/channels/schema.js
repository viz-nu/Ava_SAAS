export const channelTypeDefs = `#graphql
# Base Interface for all channels
type Channel {
  _id: ID!
  name: String!
  business: ID!
  type: ChannelTypeEnum!
  status: String
  webhookUrl: String
  systemPrompt: String
  isPublic: Boolean
  UIElements: JSON
  createdAt: String
  updatedAt: String
  config:JSON
}
enum ChannelTypeEnum {
    email
    whatsapp
    telegram
    web
    phone
    sms
    instagram
    twilio
}
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