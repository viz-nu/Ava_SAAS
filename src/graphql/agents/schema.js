export const agentTypeDefs = `#graphql
  """ Defines the color scheme for different UI elements """
  type ColorBox {
    """ Background color in hex/rgb format """
    backgroundColor: String
    """ Text color in hex/rgb format """
    textColor: String
  }

  """ Visual appearance configuration for the agent's UI """
  type Appearance {
    """ Color scheme for client/user messages """
    clientMessageBox: ColorBox
    """ Color scheme for agent/bot messages """
    avaMessageBox: ColorBox
    """ Color scheme for the text input area """
    textInputBox: ColorBox
    """ Color scheme for quick questions on welcome screen """
    quickQuestionsWelcomeScreenBox: ColorBox
  }

  """ Core information and settings that define the agent's behavior """
  type PersonalInfo {
    """ Display name of the agent """
    name: String
    """ Base prompt that defines the agent's role and behavior """
    systemPrompt: String
    """ Predefined questions users can quickly select """
    quickQuestions: [QuickQuestion]
    """ Initial message shown to users """
    welcomeMessage: String
    """ AI model to be used (e.g. GPT-3, GPT-4) """
    model: String
    """ Creativity/randomness parameter for responses (0-1) """
    temperature: Float
     VoiceAgentSessionConfig: JSON,
  }

  """ Main agent type containing all agent properties """
  type Agent {
    """ Unique identifier """
    _id: ID!
    """ Visual customization settings """
    appearance: Appearance
    """ Core agent configuration """
    personalInfo: PersonalInfo
    """ Associated knowledge collections """
    collections: [Collection]
    """ Communication channels the agent is active on """
    channels: [Channel]
    """ Available actions/functions the agent can perform """
    actions: [Action]
    """ Business that owns this agent """
    business: Business
    """ Performance and usage metrics """
    analysisMetrics: JSON
    """ User who created the agent """
    createdBy: User
    """ Whether the agent is publicly accessible """
    isPublic: Boolean
    """ Whether the agent is highlighted/promoted """
    isFeatured: Boolean
    """ Creation timestamp """
    createdAt: DateTime
    """ Last update timestamp """
    updatedAt: DateTime
  }

  """ Input type for color scheme configuration """
  input ColorBoxInput {
    backgroundColor: String
    textColor: String
  }

  """ Input type for appearance settings """
  input AppearanceInput {
    clientMessageBox: ColorBoxInput
    avaMessageBox: ColorBoxInput
    textInputBox: ColorBoxInput
    quickQuestionsWelcomeScreenBox: ColorBoxInput
  }

  """ Input type for core agent settings """
  input AgentPersonalInfoInput {
    name: String
    systemPrompt: String
    quickQuestions: [QuickQuestionInput]
    welcomeMessage: String
    model: String
    temperature: Float
    VoiceAgentSessionConfig:JSON
  }

  """ Input type for creating/updating agents """
  input AgentInput {
    appearance: AppearanceInput
    personalInfo: AgentPersonalInfoInput
    collections: [ID]
    channels: [ID]
    actions: [ID]
    analysisMetrics: JSON
    isPublic: Boolean
    isFeatured: Boolean
  }

  type Query {
    """ Get all agents for the user's business
        @param limit - Maximum number of agents to return
        @param isPublic - Filter by public/private status
        @param isFeatured - Filter by featured status
        @param id - Optional ID to fetch a specific agent """
    agents(limit: Int isPublic: Boolean isFeatured: Boolean id: ID): [Agent] @requireScope(scope: "agent:read") @requireBusinessAccess
    """ Get an ephemeral token for an agent
        @param id - ID of agent to get the token for """
    ephemeralToken(id: ID,model: String, voice: String, provider: String): JSON @requireScope(scope: "agent:read") @requireBusinessAccess
  }

  type Mutation {
    """ Create a new agent
        @param agent - Agent configuration data """
    createAgent(agent: AgentInput!): Agent @requireScope(scope: "agent:create") @requireBusinessAccess

    """ Update an existing agent
        @param id - ID of agent to update
        @param agent - New agent configuration """
    updateAgent(id: ID!, agent: AgentInput!): Agent @requireScope(scope: "agent:update") @requireBusinessAccess

    """ Delete an agent
        @param id - ID of agent to delete """
    deleteAgent(id: ID!): Boolean @requireScope(scope: "agent:delete") @requireBusinessAccess

    """ Test prompt generation for an agent
        @param prompt - Test prompt to generate from """
    generatePrompt(prompt: String!): String @requireScope(scope: "agent:manage_prompts") @requireBusinessAccess
  }
`; 