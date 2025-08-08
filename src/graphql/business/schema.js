export const businessTypeDefs = `#graphql
  type Business {
    _id: ID!
    name: String
    logoURL: String
    facts: [String]
    quickQuestions: [QuickQuestion]
    sector: String
    tagline: String
    address: String
    description: String
    MAX_DAYS: Int
    contact: Contact
    createdBy: User
    members: [User]
    documents: [JSON]
    analytics: Analytics
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Contact {
    mail: String
    phone: String
    website: String
  }

  type Analytics {
    lastUpdated: DateTime
    engagementOverview: EngagementOverview
    conversationAnalytics: JSON
    creditsUsage: CreditsUsage
  }

  type EngagementOverview {
    agentWiseBreakdown: [AgentEngagement]
  }

  type AgentEngagement {
    agent: Agent
    channel: String
    totalConversations: Int
    averageSessionDurationInSeconds: Int
    engagementTimeSlots: [Int]
    dailyConversationCounts: JSON
    engagementScale: Int
  }

  type CreditsUsage {
    knowledgeCosts: CostBreakdown
    chatCosts: CostBreakdown
    analysisCosts: CostBreakdown
    miscellaneousCosts: JSON
  }

  type CostBreakdown {
    totalTokens: Int
    inputTokens: Int
    outputTokens: Int
    totalCost: Float
  }

  input QuickQuestionInput {
    label: String
    value: String
  }

  input ContactInput {
    mail: String
    phone: String
    website: String
  }

  input BusinessInput {
    name: String
    logoURL: String
    facts: [String]
    quickQuestions: [QuickQuestionInput]
    sector: String
    tagline: String
    address: String
    description: String
    MAX_DAYS: Int
    contact: ContactInput
  }

  type Query {
    # Get business information
    business(id: ID): Business @requireScope(scope: "business:read") @requireBusinessAccess

    # Get business analytics
    businessAnalytics(businessId: ID): Analytics @requireScope(scope: "business:view_analytics") @requireBusinessAccess

    # Get business members
    businessMembers(businessId: ID): [User] @requireScope(scope: "business:manage_members") @requireBusinessAccess

    # Export business data
    exportBusinessData(businessId: ID, format: String): String @requireScope(scope: "business:export_data") @requireBusinessAccess
  }

  type Mutation {
    # Create a new business (super admin only)
    createBusiness(business: BusinessInput!): Business @requireScope(scope: "business:create")

    # Update business information
    updateBusiness(id: ID!, business: BusinessInput!): Business @requireScope(scope: "business:update") @requireResourceOwnership(model: "Business", idField: "id")

    # Delete a business (super admin only)
    deleteBusiness(id: ID!): Boolean @requireScope(scope: "business:delete") @requireResourceOwnership(model: "Business", idField: "id")

    # Add member to business
    addBusinessMember(businessId: ID!, userId: ID!, role: String): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")

    # Remove member from business
    removeBusinessMember(businessId: ID!, userId: ID!): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")

    # Update member role
    updateMemberRole(businessId: ID!, userId: ID!, role: String!): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")
  }
`; 