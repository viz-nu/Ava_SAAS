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
}
type QuickQuestion {
  label: String
  value: String
}

type ModelConfig {
  type: String
  default: String
}

type PersonalInfo {
  name: String
  systemPrompt: String
  quickQuestions: [QuickQuestion]
  welcomeMessage: String
  model: String
  temperature: Float
}
type Agent {
  appearance: Appearance
  personalInfo: PersonalInfo
  collections: [JSON]
  channels: [JSON]
  actions: [JSON]
  business: JSON
  analysisMetrics: JSON
  facets: [String]
  createdBy: JSON
  isPublic: Boolean
  isFeatured: Boolean
}
type Appearance {
  clientMessageBox: ColorBox
  avaMessageBox: ColorBox
  textInputBox: ColorBox
  quickQuestionsWelcomeScreenBox: ColorBox
}
type ColorBox {
  backgroundColor: String
  textColor: String
}
type Conversation {
  _id: ID!
  channel: ChannelStatusEnum
  agent: Agent
  status: ConversationStatusEnum
  geoLocation: JSON
  analysisMetrics: JSON
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

input ConversationInput {
  channel: String
  telegramChatId: String
  whatsappChatId: String
  agent: ID
  status: ConversationStatusEnum
  geoLocation: JSON
  analysisMetrics: JSON
  metadata: MetadataInput
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
  geoLocation:JSON
  disconnectReason:String
  ): [Conversation]
}

# type Mutation {
#   addConversation(conversation: ConversationInput!): Conversation
#   updateConversation(id: ID!, conversation: ConversationInput!): Conversation
#   deleteConversation(id: ID!): Boolean
# }

`;
