export const IntegrationTypeDefs = `#graphql
enum IntegrationTypeEnum {
    """Zoho CRM integration"""
    zoho
    """Twilio SMS and Voice integration"""
    twilio
}

"""Configuration details for the integration"""
type Config {
    """Twilio Account SID"""
    AccountSid: String
    """State of the integration"""
    state: String
    """API domain URL for Zoho"""
    apiDomainUrl: String
    """Zoho domain region (e.g., com, eu, in)"""
    domain: String
    """Scope of the integration"""
    scope: String
    """Expiration date of the access token"""
    expiresAt: DateTime
}

"""Metadata about the integration"""
type MetaData {
    """Name of the integration"""
    name: String
    """Description of the integration"""
    description: String
    """Icon URL for the integration"""
    icon: String
    """Color associated with the integration"""
    color: String
    """Purpose of the integration (e.g., CRM, SMS)"""
    purpose: String
    """Type of the integration (e.g., zoho, twilio)"""
    type: IntegrationTypeEnum
}

"""
Integration configuration
"""
type Integration {  
    """Unique identifier for the integration"""
    _id: ID!
    """Business associated with the integration"""
    business: Business
    """Metadata about the integration"""
    metaData: MetaData
    """Configuration details for the integration"""
    config: Config
    """Indicates if the integration is active"""
    isActive: Boolean
    """User who created the integration"""
    createdBy: User
    """Creation timestamp"""
    createdAt: DateTime
    """Last update timestamp"""
    updatedAt: DateTime
}

type Query {
    """Fetch integration details by ID or business context
    """
    fetchIntegration(id: ID): [Integration] @requireScope(scope: "integration:read") @requireBusinessAccess
}

type Mutation {
    """
    Create a new Zoho CRM integration
    Exchanges authorization code for access tokens and stores integration details
    """
    createIntegration(
        """Authorization code from OAuth callback"""
        code: String
        """Zoho domain region (com, eu, in, com_au, jp, ca)"""
        domain: String
        name: String!
        purpose:String
        """Type of integration (zoho, twilio)"""
        type: IntegrationTypeEnum!
        """Twilio Account SID (required for Twilio integration)"""
        AccountSid: String
        """State of the integration"""
        state: String 
    ): Integration @requireScope(scope: "integration:create") @requireBusinessAccess
    deAuthorizeIntegration(
        """ID of the integration to deauthorize"""
        integrationId: ID!) : Boolean @requireScope(scope: "integration:delete") @requireBusinessAccess
}
`