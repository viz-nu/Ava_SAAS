export const agentTypeDefs = `#graphql

  type ColorBox {
    backgroundColor: String
    textColor: String
  }

  type Appearance {
    clientMessageBox: ColorBox
    avaMessageBox: ColorBox
    textInputBox: ColorBox
    quickQuestionsWelcomeScreenBox: ColorBox
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
    _id: ID!
    appearance: Appearance
    personalInfo: PersonalInfo
    collections: [Collection]
    channels: [Channel]
    actions: [Action]
    business: Business
    analysisMetrics: JSON
    createdBy: User
    isPublic: Boolean
    isFeatured: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }
  input AgentInput {
    appearance: Appearance
    personalInfo: PersonalInfo
    collections: [ID]
    channels: [ID]
    actions: [ID]
    analysisMetrics: JSON
    isPublic: Boolean
    isFeatured: Boolean
  }
  type Query {
    # Get all agents for the user's business
    agents(  limit: Int  isPublic: Boolean  isFeatured: Boolean  id: ID ): [Agent] @requireScope(scope: "agent:read") @requireBusinessAccess
  }

  type Mutation {
    # Create a new agent
    createAgent(agent: AgentInput!): Agent @requireScope(scope: "agent:create") @requireBusinessAccess

    # Update an existing agent
    updateAgent(id: ID!, agent: AgentInput!): Agent @requireScope(scope: "agent:update") @requireBusinessAccess

    # Delete an agent
    deleteAgent(id: ID!): Boolean @requireScope(scope: "agent:delete") @requireBusinessAccess

    # Test agent prompt generation
    generatePrompt(prompt: String!): String @requireScope(scope: "agent:manage_prompts") @requireBusinessAccess
  }
`; 