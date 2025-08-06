export const agentTypeDefs = `#graphql
  type Query {
    # Get all agents for the user's business
    agents(
      limit: Int
      isPublic: Boolean
      isFeatured: Boolean
      business: ID
    ): [Agent] @requireScope(scope: "agent:read") @requireBusinessAccess

    # Get a specific agent by ID
    agent(id: ID!): Agent @requireScope(scope: "agent:read") @requireResourceOwnership(model: "Agent", idField: "id")

    # Get public agents (no auth required)
    publicAgents(
      limit: Int
      isFeatured: Boolean
    ): [Agent]

    # Get featured agents (no auth required)
    featuredAgents(
      limit: Int
    ): [Agent]
  }

  type Mutation {
    # Create a new agent
    createAgent(agent: AgentInput!): Agent @requireScope(scope: "agent:create") @requireBusinessAccess

    # Update an existing agent
    updateAgent(id: ID!, agent: AgentInput!): Agent @requireScope(scope: "agent:update") @requireResourceOwnership(model: "Agent", idField: "id")

    # Delete an agent
    deleteAgent(id: ID!): Boolean @requireScope(scope: "agent:delete") @requireResourceOwnership(model: "Agent", idField: "id")

    # Test agent prompt generation
    generatePrompt(prompt: String!, agentId: ID!): String @requireScope(scope: "agent:manage_prompts") @requireResourceOwnership(model: "Agent", idField: "agentId")

    # Deploy agent to channel
    deployAgent(agentId: ID!, channelId: ID!): Boolean @requireScope(scope: "agent:deploy") @requireResourceOwnership(model: "Agent", idField: "agentId")

    # Test agent response
    testAgent(agentId: ID!, message: String!): String @requireScope(scope: "agent:test") @requireResourceOwnership(model: "Agent", idField: "agentId")
  }
`; 