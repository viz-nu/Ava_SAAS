export const sharedTypeDefs = `#graphql
  scalar DateTime
  scalar JSON

  type Business {
    _id: ID!
    name: String
    logoURL: String
    sector: String
    tagline: String
  } 

  type User {
    _id: ID!
    name: String
    email: String
    role: String
    scopes: [String]
    business: Business
    isVerified: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  } 

  type QuickQuestion {
    label: String
    value: String
  }

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
    collections: [JSON]
    channels: [JSON]
    actions: [JSON]
    business: Business
    analysisMetrics: JSON
    facets: [String]
    createdBy: User
    isPublic: Boolean
    isFeatured: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  input QuickQuestionInput {
    label: String
    value: String
  }

  input ColorBoxInput {
    backgroundColor: String
    textColor: String
  }

  input AppearanceInput {
    clientMessageBox: ColorBoxInput
    avaMessageBox: ColorBoxInput
    textInputBox: ColorBoxInput
    quickQuestionsWelcomeScreenBox: ColorBoxInput
  }

  input PersonalInfoInput {
    name: String
    systemPrompt: String
    quickQuestions: [QuickQuestionInput]
    welcomeMessage: String
    model: String
    temperature: Float
  }

  input AgentInput {
    appearance: AppearanceInput
    personalInfo: PersonalInfoInput
    collections: [JSON]
    channels: [JSON]
    actions: [JSON]
    business: ID
    isPublic: Boolean
    isFeatured: Boolean
  }
`; 