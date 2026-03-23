export const leadTypeDefs = `#graphql
type Lead {
    _id: ID!
    template: LeadTemplate
    business: Business
    createdBy: User
    data: JSON
    notes: String
    createdAt: DateTime
    updatedAt: DateTime
}
type LeadTemplate {
    _id: ID!
    name: String
    description: String
    fields: JSON
    isActive: Boolean
    createdBy: User
    business: Business
    createdAt: DateTime
    updatedAt: DateTime
}
type LeadPagination {
    data: [Lead]
    metaData: LeadPaginationMetaData
}
type LeadPaginationMetaData {
    page: Int
    limit: Int
    totalPages: Int
    totalDocuments: Int
}
input LeadCreateInput {
    templateId: ID!
    data: JSON!
    notes: String
}
input LeadTemplateInput {
    name: String
    description: String
    fields: JSON
    isActive: Boolean
}
    type Query {
    fetchleadsTemplates(limit: Int, templateId: ID, id: ID, isActive: Boolean): [LeadTemplate]
    fetchLeads(limit: Int templateId: ID page: Int id: ID status: String origin: String creator: String tags: [String]): LeadPagination
    fetchLeadFacets(templateId: ID, status: String creator: String origin: String tags: [String]): JSON
}
    type Mutation {
    createLeadTemplate(LeadTemplateInput: LeadTemplateInput): LeadTemplate
    updateLeadTemplate(id: ID!, LeadTemplateInput: LeadTemplateInput): LeadTemplate
    deleteLeadTemplate(id: ID): Boolean
    createLead(LeadCreateInput: LeadCreateInput): Lead
    bulkCreateLeads(dataList: [LeadCreateInput!]!): [Lead]
    updateLead(id: ID!, LeadCreateInput: LeadCreateInput): Lead
    deleteLead(id: ID): Boolean
}
`;



