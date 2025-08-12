export const sharedTypeDefs = `#graphql
  """Custom scalar for handling dates and times"""
  scalar DateTime
  """Custom scalar for handling arbitrary JSON data"""
  scalar JSON

  """Represents a quick question with label and value"""
  type QuickQuestion {
    """Display label for the question"""
    label: String
    """Answer/value for the question"""
    value: String
  }

  """Input type for creating/updating quick questions"""
  input QuickQuestionInput {
    """Display label for the question"""
    label: String
    """Answer/value for the question"""
    value: String
  }

  """Contact information for a business"""
  type Contact {
    """Email address"""
    mail: String
    """Phone number"""
    phone: String
    """Website URL"""
    website: String
  }

  """Represents a business entity"""
  type Business {
    """Unique identifier"""
    _id: ID!
    """Business name"""
    name: String
    """URL to business logo image"""
    logoURL: String
    """Industry/sector the business operates in"""
    sector: String
    """Short descriptive tagline"""
    tagline: String
    """List of key facts about the business"""
    facts: [String]
    """List of quick Q&A about the business"""
    quickQuestions: [QuickQuestion]
    """Physical address"""
    address: String
    """Detailed business description"""
    description: String
    """Contact information"""
    contact: Contact
    """User who created the business"""
    createdBy: User
    """Additional document data"""
    docData: JSON
    """Creation timestamp"""
    createdAt: DateTime
    """Last update timestamp"""
    updatedAt: DateTime
  }

  """Represents a user account"""
  type User {
    """Unique identifier"""
    _id: ID!
    """User's full name"""
    name: String
    """Email address"""
    email: String
    """User role (e.g. admin, user)"""
    role: String
    """Permission scopes granted to user"""
    scopes: [String]
    """Associated business if any"""
    business: Business
    """Whether email is verified"""
    isVerified: Boolean
    """Creation timestamp"""
    createdAt: DateTime
    """Last update timestamp"""
    updatedAt: DateTime
  }

`; 