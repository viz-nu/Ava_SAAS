export const paymentsTypeDefs = `#graphql
type Subscription {
    _id: ID!
    code: String
    name: String
    description: String
    price:JSON
    type: subscriptionTypeEnum
    validity: Int
    credits:CreditsType
    spendRatio: Int
    status: subscriptionStatusEnum
    features: [String]
    allowedTopUps: [SubscriptionType]
    autoRenew: Boolean
    createdAt: DateTime
    updatedAt: DateTime
}
type CreditsType {
    llm: Int
    knowledge: Int
    miscellaneous: Int
}
enum subscriptionTypeEnum {
    FREE
    BASE
    TOPUP
}
enum subscriptionStatusEnum {
    active
    inactive
}
input SubscriptionInput {
    code: String
    name: String
    description: String
    price:JSON
    type: subscriptionTypeEnum
    validity: Int
    credits:CreditsType
    spendRatio: Int
    status: subscriptionStatusEnum
    features: [String]
    allowedTopUps: [ID]
    autoRenew: Boolean
}
type Query {
    fetchPublicSubscriptions(code: String, name: String, type: subscriptionTypeEnum, status: subscriptionStatusEnum, id: ID): [Subscription]
    fetchSubscriptions(code: String, name: String, type: subscriptionTypeEnum, status: subscriptionStatusEnum, id: ID): [Subscription] @requireScope(scope: "super:all")

}
type Mutation {
    createAVASubscription(input: SubscriptionInput!): SubscriptionType @requireScope(scope: "super:all")
    updateAVASubscription(id: ID!, input: SubscriptionInput!): SubscriptionType @requireScope(scope: "super:all")
    deleteAVASubscription(id: ID!): Boolean @requireScope(scope: "super:all")
    startSubscription(subscriptionId: ID!, gateway: String!, paymentType: String): Payment @requireScope(scope: "subscription:upgrade")
}
`;
// subscriptionUpdate(subscriptionId: ID!, gateway: String!, paymentType: String): Payment @requireScope(scope: "subscription:upgrade")
// subscriptionDelete(subscriptionId: ID!): Boolean @requireScope(scope: "subscription:upgrade")
// subscriptionPause(subscriptionId: ID!): Boolean @requireScope(scope: "subscription:upgrade")
// subscriptionResume(subscriptionId: ID!): Boolean @requireScope(scope: "subscription:upgrade")
// subscriptionCancel(subscriptionId: ID!): Boolean @requireScope(scope: "subscription:upgrade")
// subscriptionFetch(subscriptionId: ID!): Subscription @requireScope(scope: "subscription:upgrade")
// subscriptionFetchInvoices(subscriptionId: ID!): [Invoice] @requireScope(scope: "subscription:upgrade")