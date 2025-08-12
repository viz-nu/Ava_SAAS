export const sharedTypeDefs = `#graphql
  scalar DateTime
  scalar JSON

  type QuickQuestion {
    label: String
    value: String
  }
  type Contact {
    mail: String
    phone: String
    website: String
  }

  type Business {
    _id: ID!
    name: String
    logoURL: String
    sector: String
    tagline: String
    facts: [String]
    quickQuestions: [QuickQuestion]
    address: String
    description: String
    contact: Contact
    createdBy: User
    docData: JSON
    createdAt: DateTime
    updatedAt: DateTime
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


`; 