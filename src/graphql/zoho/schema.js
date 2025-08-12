export const zohoTypeDefs = `#graphql
"""
Zoho CRM domain regions for API endpoints
"""
enum domainEnums {
    """United States"""
    com
    """Europe"""
    eu
    """India"""
    in
    """Australia"""
    com_au
    """Japan"""
    jp
    """Canada"""
    ca
}

"""
Integration configuration for Zoho CRM
"""
type Integration {  
    """Unique identifier for the integration"""
    _id: ID!
    """Associated business"""
    business: Business
    """Zoho domain region (com, eu, in, etc.)"""
    domain: domainEnums
    """Zoho API domain URL"""
    apiDomainUrl: String
    """Integration type (e.g., 'zoho')"""
    type: String
    """Display name for the integration"""
    name: String
    """Description of the integration"""
    description: String
    """Icon URL for the integration"""
    icon: String
    """Theme color for the integration"""
    color: String
    """Integration URL"""
    url: String
    """Purpose and capabilities of the integration"""
    purpose: JSON
    """OAuth scope permissions"""
    scope: String
    """User who created the integration"""
    createdBy: User
}

type Query {
    """
    Generate OAuth authorization URL for Zoho CRM
    Returns the URL where users can authorize the application
    """
    fetchZohoURL(
        """Zoho domain region (com, eu, in, com_au, jp, ca)"""
        domain: String!
    ): String!
    
    """
    Get all available modules from Zoho CRM
    Returns list of CRM modules like Leads, Contacts, Deals, etc.
    """
    getZohoModules(
        """Integration ID"""
        id: ID!
    ): JSON!
    
    """
    Fetch records from a specific Zoho CRM module
    Supports pagination, filtering, and sorting options
    """
    getZohoRecords(
        """Integration ID"""
        id: ID!
        """Module name (e.g., 'Leads', 'Contacts', 'Deals')"""
        module: String!
        """Query options: page, per_page, fields, sort_order, sort_by"""
        options: JSON
    ): JSON!
    
    """
    Search records in a Zoho CRM module using criteria
    Supports complex search queries with operators
    """
    searchZohoRecords(
        """Integration ID"""
        id: ID!
        """Module name (e.g., 'Leads', 'Contacts', 'Deals')"""
        module: String!
        """Search criteria (e.g., '(Email:equals:john@example.com)')"""
        criteria: String!
    ): JSON!
}

type Mutation {
    """
    Create a new Zoho CRM integration
    Exchanges authorization code for access tokens and stores integration details
    """
    createZohoIntegration(
        """Authorization code from OAuth callback"""
        code: String!
        """Zoho domain region (com, eu, in, com_au, jp, ca)"""
        domain: String!
    ): Integration
    
    """
    Create a new custom module in Zoho CRM
    Allows creating custom modules with specific fields and layouts
    """
    createZohoModule(
        """Integration ID"""
        id: ID!
        """Module configuration object"""
        module: JSON!
    ): JSON!
    
    """
    Create multiple records in a Zoho CRM module
    Supports bulk creation of records with validation
    """
    createZohoRecords(
        """Integration ID"""
        id: ID!
        """Module name (e.g., 'Leads', 'Contacts', 'Deals')"""
        module: String!
        """Array of record objects to create"""
        records: [JSON!]!
    ): JSON!
    
    """
    Update an existing record in Zoho CRM
    Modifies specific fields of a record by ID
    """
    updateZohoRecord(
        """Integration ID"""
        id: ID!
        """Module name (e.g., 'Leads', 'Contacts', 'Deals')"""
        module: String!
        """Record ID to update"""
        recordId: String!
        """Updated record data"""
        record: JSON!
    ): JSON!
    
    """
    Delete a record from Zoho CRM
    Permanently removes a record by ID
    """
    deleteZohoRecord(
        """Integration ID"""
        id: ID!
        """Module name (e.g., 'Leads', 'Contacts', 'Deals')"""
        module: String!
        """Record ID to delete"""
        recordId: String!
    ): JSON!
}
`