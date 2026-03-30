export const serviceProvidersTypeDefs = `#graphql
type Provider {
    _id: ID!
    name: String
    description: String
    icon: String
    color: String
}
type ProviderPagination {
    data: [Provider]
    metaData: ProviderPaginationMetaData
}
type ProviderPaginationMetaData {
    page: Int
    limit: Int
    totalPages: Int
    totalDocuments: Int
}
type Query {
    fetchProviders(name: String, description: String, icon: String, color: String, _id: ID, page: Int, limit: Int): ProviderPagination
}
type Mutation {
    createProvider(name: String, description: String, icon: String, color: String): Provider
    updateProvider(id: ID!, name: String, description: String, icon: String, color: String): Provider
    deleteProvider(id: ID!): Boolean
}
`;