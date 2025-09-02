export const channelTypeDefs = `#graphql
"""Base Interface for all communication channels"""
type Channel {
  """Unique identifier for the channel"""
  _id: ID!
  """Display name of the channel"""
  name: String!
  """ID of the business that owns this channel"""
  business: ID!
  """Type of communication channel (email, whatsapp, etc)"""
  type: ChannelTypeEnum!
  """Current status of the channel (active, inactive, etc)"""
  status: String
  """URL for receiving webhook notifications"""
  webhookUrl: String
  """Base prompt that defines how the agent behaves on this channel"""
  systemPrompt: String
  """Whether the channel is publicly accessible"""
  isPublic: Boolean
  """Custom UI configuration elements"""
  UIElements: JSON
  """Creation timestamp"""
  createdAt: DateTime
  """Last update timestamp"""
  updatedAt: DateTime
  """Channel-specific configuration settings"""
  config: JSON
}

"""Supported communication channel types"""
enum ChannelTypeEnum {
    """Email communication channel"""
    email
    """WhatsApp messaging channel"""
    whatsapp
    """Telegram bot channel"""
    telegram
    """Web chat/widget channel"""
    web
    """Voice call channel"""
    phone
    """SMS text messaging channel"""
    sms
    """Instagram messaging channel"""
    instagram
    """Twilio integration channel"""
    twilio
}

type Query {
  """Get channels matching the specified filters
  @param _id - Optional channel ID to fetch a specific channel
  @param type - Filter by channel type
  @param status - Filter by channel status"""
  getChannels(_id: ID, type: ChannelTypeEnum, status: String): [Channel] @requireScope(scope: "channel:read")
}

"""Input type for creating/updating channels"""
input ChannelInput {
  """Display name of the channel"""
  name: String
  """Type of communication channel (required)"""
  type: ChannelTypeEnum!
  """Channel-specific configuration settings"""
  config: JSON
  """Base prompt that defines how the agent behaves"""
  systemPrompt: String
  """Whether the channel is publicly accessible"""
  isPublic: Boolean
  """Custom UI configuration elements"""
  UIElements: JSON
}

type Mutation {
  """Create a new communication channel
  @param input - Channel configuration data"""
  createChannel(input: ChannelInput!): Channel @requireScope(scope: "channel:create") @requireBusinessAccess

  """Update an existing channel
  @param id - ID of channel to update
  @param input - New channel configuration"""
  updateChannel(id: ID!, input: ChannelInput!): Channel @requireScope(scope: "channel:update") @requireBusinessAccess

  """Delete a channel
  @param id - ID of channel to delete"""
  deleteChannel(id: ID!): Boolean @requireScope(scope: "channel:delete") @requireBusinessAccess
}
`; 