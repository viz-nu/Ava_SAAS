export const ticketTypeDefs = `#graphql
"""Priority levels for tickets"""
enum priorityEnum {
  """Low urgency/impact"""
  low
  """Medium urgency/impact"""
  medium
  """High urgency/impact"""
  high
}

"""Current status of a ticket"""
enum statusEnum {
  """Awaiting initial response"""
  pending 
  """Response sent but not resolved"""
  responded 
  """Issue has been resolved"""
  resolved
}

"""Contact information for ticket creator"""
type contactDetails {
    """Email address"""
    email: String
    """Phone number"""
    phone: String
    """Telegram user ID"""
    telegramId: String
    """WhatsApp user ID"""
    whatsappId: String
    """Instagram user ID"""
    instagramId: String
}

"""Response details for a ticket"""
type response {
    """Sender email address"""
    from: String
    """Recipient email address"""
    to: String
    """Carbon copy recipients"""
    cc: String
    """Email subject line"""
    subject: String
    """Blind carbon copy recipients"""
    bcc: String
    """Plain text content"""
    text: String
    """HTML formatted content"""
    html: String
    """Last update timestamp"""
    updatedAt: DateTime
    """When response was sent"""
    sentAt: DateTime
    """When ticket was resolved"""
    resolvedAt: DateTime
}

"""Input type for creating/updating responses"""
input responseInput {
    """Sender email address"""
    from: String
    """Recipient email address"""
    to: String
    """Carbon copy recipients"""
    cc: String
    """Email subject line"""
    subject: String
    """Blind carbon copy recipients"""
    bcc: String
    """Plain text content"""
    text: String
    """HTML formatted content"""
    html: String
}

"""Represents a support ticket"""
type Ticket {
    """Unique identifier"""
    _id: String
    """Email of person who created ticket"""
    notifierEmail: String
    """Brief description of the issue"""
    issueSummary: String
    """Communication channel used"""
    channel: ChannelTypeEnum
    """Ticket priority level"""
    priority: priorityEnum
    """Current ticket status"""
    status: statusEnum
    """Contact details for ticket creator"""
    contactDetails: contactDetails
    """Response information"""
    response: response
    """Creation timestamp"""
    createdAt: DateTime
    """Last update timestamp"""
    updatedAt: DateTime
}

type Query {
    """
    Fetch tickets matching specified filters
    @param notifierEmail - Filter by creator's email
    @param channel - Filter by communication channel
    @param priority - Filter by priority level
    @param status - Filter by current status
    @param id - Find specific ticket by ID
    """
    fetchTickets(notifierEmail: String channel: ChannelTypeEnum priority: priorityEnum status: statusEnum id:ID): [Ticket] @requireScope(scope: "ticket:read")
}

type Mutation {
  """
  Update an existing ticket with new response
  @param id - ID of ticket to update
  @param input - New response details
  """
  updateTicket(id: ID! input: responseInput!): Ticket @requireScope(scope: "ticket:update") @requireBusinessAccess
  
  """
  Delete a ticket
  @param id - ID of ticket to delete
  """
  deleteTicket(id: ID!): Boolean @requireScope(scope: "ticket:delete") @requireBusinessAccess
}

`;