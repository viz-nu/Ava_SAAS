export const leadTypeDefs = `#graphql
type Lead {
    _id: ID!
    template: LeadTemplate
    business: Business
    createdBy: User
    data: JSON
    status: String
    notes: String
    createdAt: DateTime
    updatedAt: DateTime
}
type LeadTemplate {
    _id: ID!
    name: String
    description: String
    fields: [LeadTemplateField]
    isActive: Boolean
    createdBy: User
    business: Business
    createdAt: DateTime
    updatedAt: DateTime
}
type LeadTemplateField {
    name: String
    type: LeadTemplateFieldTypeEnum
    required: Boolean
    defaultValue: JSON
    validation: JSON
    label: String
    placeholder: String
    description: String
}
input LeadTemplateFieldInput {
    name: String
    type: LeadTemplateFieldTypeEnum
    required: Boolean
    defaultValue: JSON
    validation: JSON
    label: String
    placeholder: String
    description: String
}
enum LeadTemplateFieldTypeEnum {
    string
    number
    email
    phone
    date
    boolean
    url
    text
}
input LeadCreateInput {
    templateId: ID!
    data: JSON!
    status: String
    notes: String
}
input LeadTemplateInput {
    name: String
    description: String
    fields: [LeadTemplateFieldInput]
    isActive: Boolean
}
    type Query {
    fetchleadsTemplates(limit: Int, templateId: ID, id: ID, isActive: Boolean): [LeadTemplate]
    fetchLeads(limit: Int, templateId: ID, id: ID, status: String): [Lead]
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



