export const paymentTypeDefs = `#graphql
type Plan {
    _id: ID!
    code: String
    name: String
    description: String
    price:JSON
    type: PlanTypeEnum
    validity: Int
    credits:CreditsType
    spendRatio: Int
    status: PlanStatusEnum
    features: [String]
    allowedTopUps: [Plan]
    autoRenew: Boolean
    createdAt: DateTime
    updatedAt: DateTime
}
type CreditsType {
    llm: Int
    knowledge: Int
    miscellaneous: Int
}
    input CreditsTypeInput {
    llm: Int
    knowledge: Int
    miscellaneous: Int
}
enum PlanTypeEnum {
    FREE
    BASE
    TOPUP
}
enum PlanStatusEnum {
    active
    inactive
}
input PlanInput {
    code: String
    name: String
    description: String
    price:JSON
    type: PlanTypeEnum
    validity: Int
    credits:CreditsTypeInput
    spendRatio: Int
    status: PlanStatusEnum
    features: [String]
    allowedTopUps: [ID]
    autoRenew: Boolean
} 
type Query {
    fetchPublicPlans(code: String, name: String, type: PlanTypeEnum, status: PlanStatusEnum, id: ID): [Plan]
    fetchPlans(code: String, name: String, type: PlanTypeEnum, status: PlanStatusEnum, id: ID): [Plan] @requireScope(scope: "super:all")
}
type Mutation {
    createAVAPlan(input: PlanInput!): Plan @requireScope(scope: "super:all")
    updateAVAPlan(id: ID!, input: PlanInput!): Plan @requireScope(scope: "super:all")
    deleteAVAPlan(id: ID!): Boolean @requireScope(scope: "super:all")
    startPayment(planId: ID!, gateway: String, paymentType: String, startDate:DateTime): JSON @requireScope(scope: "subscription:upgrade")
    cancelSubscription(id: ID!): Boolean @requireScope(scope: "subscription:upgrade")
}
`;