export const conversationTypeDefs =
  `#graphql
"""Available communication channels for conversations"""
enum ChannelStatusEnum {
  """Email communication"""
  email
  """WhatsApp messaging"""
  whatsapp
  """Telegram bot"""
  telegram
  """Web chat widget"""
  web
  """Voice calls"""
  phone
  """SMS text messaging"""
  sms
  """Instagram messaging"""
  instagram
}

"""User reactions to conversation messages"""
type Reactions {
  """Number of neutral reactions"""
  neutral: Int
  """Number of positive reactions"""
  like: Int
  """Number of negative reactions"""
  dislike: Int
}

"""Metadata about the conversation"""
type Metadata {
  """Total number of messages exchanged"""
  totalMessages: Int
  """User reactions to messages"""
  reactions: Reactions
  """Geographic location of the user"""
  userLocation: JSON
  """Socket connection details"""
  sockets: Sockets
  """Current conversation status"""
  status: String
  browserUrl: String
}

"""WebSocket connection information"""
type Sockets {
  """ID of the socket connection"""
  socketId: String,
  """Reason for socket disconnection if applicable"""
  disconnectReason: String
}

"""AI model configuration"""
type ModelConfig {
  """Type of AI model"""
  type: String
  """Default model settings"""
  default: String
}

"""Represents a conversation between user and agent"""
type Conversation {
  """Unique identifier"""
  _id: ID!
  """Communication channel used"""
  channel: ChannelStatusEnum
  """AI agent handling the conversation"""
  agent: Agent
  """Data extracted from conversation"""
  extractedData: JSON
  transcripts:JSON
  """Conversation metadata"""
  metadata: Metadata
  """When conversation started"""
  createdAt: DateTime
  """When conversation was last updated"""
  updatedAt: DateTime
}

"""Input type for conversation metadata"""
input MetadataInput {
  """Total number of messages"""
  totalMessages: Int
  """User reactions data"""
  reactions: ReactionsInput
}

"""Input type for user reactions"""
input ReactionsInput {
  """Number of neutral reactions"""
  neutral: Int
  """Number of positive reactions"""
  like: Int
  """Number of negative reactions"""
  dislike: Int
}

type Query {
  """Get conversations matching specified filters
  @param limit - Maximum number of conversations to return
  @param status - Filter by conversation status
  @param id - Get specific conversation by ID
  @param agentId - Filter by agent ID
  @param channel - Filter by communication channel
  @param from - Filter by start date
  @param to - Filter by end date
  @param userLocation - Filter by user location
  @param disconnectReason - Filter by disconnect reason"""
  conversations(
    limit: Int
    status: String
    id: ID
    agentId: ID
    channel: ChannelStatusEnum
    from: DateTime
    to: DateTime
    userLocation: JSON
    disconnectReason: String
  ): [Conversation] @requireScope(scope: "conversation:read") @requireBusinessAccess
}
`;


// no-answer
// in-progress