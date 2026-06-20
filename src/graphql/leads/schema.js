export const leadTypeDefs = `#graphql

  enum LeadStatusEnum {
    new
    contacted
    qualified
    converted
    lost
  }

  """A single platform contact entry (e.g. a WhatsApp number or email address)"""
  type LeadPlatformEntry {
    platform: String!
    handle: String
    """Label such as work, personal, brand"""
    label: String
    isPrimary: Boolean
    metadata: JSON
  }

  """All known contact handles for a lead, grouped by platform"""
  type LeadContactDetails {
    whatsapp: [LeadPlatformEntry]
    telegram: [LeadPlatformEntry]
    email: [LeadPlatformEntry]
    phone: [LeadPlatformEntry]
    twitter: [LeadPlatformEntry]
    instagram: [LeadPlatformEntry]
    facebook: [LeadPlatformEntry]
  }

  """A lead / contact in the system"""
  type Lead {
    _id: ID!
    """Optional template this lead was created from"""
    template: LeadTemplate
    business: Business
    createdBy: User
    name: String
    contactDetails: ContactDetails
    """Inbound source e.g. Whatsapp-Inbound, facebook_ads"""
    source: String
    tags: [String]
    leadScore: Int
    status: LeadStatusEnum
    notes: String
    lastInteractedAt: DateTime
    nextFollowUpAt: DateTime
    pendingTasks: JSON
    """Arbitrary template-driven data"""
    data: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  """A template that defines the shape of leads created from it"""
  type LeadTemplate {
    _id: ID!
    business: ID
    createdBy: ID
    name: String!
    description: String
    """Field definitions (schema for the lead's data object)"""
    fields: JSON
    isActive: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  type LeadPagination {
    data: [Lead]
    metaData: PaginationMetaData
  }

  type LeadTemplatePagination {
    data: [LeadTemplate]
    metaData: PaginationMetaData
  }

  # ─── Inputs ──────────────────────────────────────────────────────────────────

  """Input for creating or updating a lead"""
  input LeadCreateInput {
    templateId: ID
    name: String
    source: String
    tags: [String]
    leadScore: Int
    status: LeadStatusEnum
    notes: String
    """Arbitrary template-driven data"""
    data: JSON
  }

  """Input for creating or updating a lead template"""
  input LeadTemplateInput {
    name: String
    description: String
    fields: JSON
    isActive: Boolean
  }

  """Input row for bulk lead creation"""
  input BulkLeadCreateInput {
    templateId: ID
    name: String
    source: String
    tags: [String]
    notes: String
    data: JSON
  }

  # ─── Queries ─────────────────────────────────────────────────────────────────

  type Query {
    """Fetch paginated lead templates for the business"""
    fetchleadsTemplates(
      limit: Int
      page: Int
      id: ID
      templateId: ID
      isActive: Boolean
    ): LeadTemplatePagination @requireScope(scope: "lead:read") @requireBusinessAccess

    """Fetch paginated leads with optional filters"""
    fetchLeads(
      limit: Int
      page: Int
      templateId: ID
      id: ID
      status: LeadStatusEnum
      origin: String
      tags: [String]
    ): LeadPagination @requireScope(scope: "lead:read") @requireBusinessAccess
  }

  # ─── Mutations ───────────────────────────────────────────────────────────────

  type Mutation {
    createLeadTemplate(LeadTemplateInput: LeadTemplateInput!): LeadTemplate
      @requireScope(scope: "lead:write") @requireBusinessAccess

    updateLeadTemplate(id: ID!, LeadTemplateInput: LeadTemplateInput!): LeadTemplate
      @requireScope(scope: "lead:write") @requireBusinessAccess

    deleteLeadTemplate(id: ID!): Boolean
      @requireScope(scope: "lead:write") @requireBusinessAccess

    createLead(LeadCreateInput: LeadCreateInput!): Lead
      @requireScope(scope: "lead:write") @requireBusinessAccess

    bulkCreateLeads(dataList: [BulkLeadCreateInput!]!): [Lead]
      @requireScope(scope: "lead:write") @requireBusinessAccess

    updateLead(id: ID!, LeadCreateInput: LeadCreateInput!): Lead
      @requireScope(scope: "lead:write") @requireBusinessAccess

    deleteLead(id: ID!): Boolean
      @requireScope(scope: "lead:write") @requireBusinessAccess
  }
`;