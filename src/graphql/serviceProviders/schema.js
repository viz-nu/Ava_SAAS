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
    metaData: PaginationMetaData
}

enum apiAuthEnum {
    oauth2
    apiKey
    basic
    bearer
    jwt
    hmac
    customHeader
    mtls
    cookie
    none
}
type apiUrlTemplate {
        base: String
        path: String
        params: JSON
    }
type apiRequestTemplate {
  method: String
  url: apiUrlTemplate
  headers: JSON
  body: JSON
}
type ApiSchema {
    input: JSON
    config: JSON
    output: JSON
    error: JSON
    auth: apiAuthEnum
}

type Api {
    _id: ID!
    provider: Provider
    title: String
    description: String
    version: String
    schemas: ApiSchema
    requestTemplate: apiRequestTemplate
    requiredScopes: [String]
}
type ApiPagination {
    data: [Api]
    metaData: PaginationMetaData
}
type ApiAuthenticatorPagination {
    data: [ApiAuthenticator]
    metaData: PaginationMetaData
}
type ApiAuthenticator {
  id: ID!
  provider: Provider
  accountDetails: JSON
  scope: [String]
  isActive: Boolean
  createdBy: User
  business: Business
  authType: apiAuthEnum!
#   credentials: JSON
#   config: JSON
}

type Query {
    fetchProviders(name: String, description: String, icon: String, color: String, _id: ID, page: Int, limit: Int): ProviderPagination
    fetchApis(provider: ID, providerName: String, title: String, description: String, version: String, _id: ID, page: Int, limit: Int): ApiPagination
    fetchApiAuthenticators(provider: ID, providerName: String, _id: ID, page: Int, limit: Int): ApiAuthenticatorPagination
}
type Mutation {
    createProvider(name: String, description: String, icon: String, color: String): Provider
    updateProvider(id: ID!, name: String, description: String, icon: String, color: String): Provider
    deleteProvider(id: ID!): Boolean
    createApi(providerId: ID!, title: String, description: String, version: String, schemas: JSON, requestTemplate: JSON, requiredScopes: [String]): Api
    updateApi(id: ID!, title: String, description: String, version: String, schemas: JSON, requestTemplate: JSON, requiredScopes: [String]): Api
    deleteApi(id: ID!): Boolean
    createIntegrationAuthenticationUrl(state: String, scopes: [String]!, provider:String!):String
    createApiAuthenticator(providerId: ID!, code: String!): ApiAuthenticator
}

`;