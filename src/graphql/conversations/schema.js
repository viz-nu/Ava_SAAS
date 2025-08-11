export const conversationTypeDefs =
  `#graphql
scalar DateTime
scalar JSON

enum ConversationStatusEnum {
  initiated
  active
  interrupted
  inactive
  disconnected
}
enum ChannelStatusEnum {
  email
  whatsapp
  telegram
  web
  phone
  sms
  instagram
}

type Reactions {
  neutral: Int
  like: Int
  dislike: Int
}

type Metadata {
  totalMessages: Int
  reactions: Reactions
  userLocation: JSON
  sockets:Sockets
  status: ConversationStatusEnum
}
type Sockets{
socketId: String,
disconnectReason: String
}

type ModelConfig {
  type: String
  default: String
}

type Conversation {
  _id: ID!
  channel: ChannelStatusEnum
  agent: Agent
  extractedData: JSON
  metadata: Metadata
  createdAt: DateTime
  updatedAt: DateTime
}

input MetadataInput {
  totalMessages: Int
  reactions: ReactionsInput
}

input ReactionsInput {
  neutral: Int
  like: Int
  dislike: Int
}

type Query {
  conversations(
  limit:Int
  status: ConversationStatusEnum 
  id: ID  
  agentId: ID
  channel: ChannelStatusEnum
  from:DateTime
  to:DateTime
  userLocation:JSON
  disconnectReason:String
  ): [Conversation] @requireScope(scope: "conversation:read") @requireBusinessAccess
}

# type Mutation {
#   addConversation(conversation: ConversationInput!): Conversation
#   updateConversation(id: ID!, conversation: ConversationInput!): Conversation
#   deleteConversation(id: ID!): Boolean
# }

`;
