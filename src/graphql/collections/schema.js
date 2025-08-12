export const collectionTypeDefs = `#graphql
  enum contentSourceEnum {
    website
    youtube
    file
  }
    enum contentStatusEnum {
    active
    loading
    failed
  }
type Content {
    source: contentSourceEnum
    metaData: JSON
    status: contentStatusEnum
    error: String
}
  type Collection {
    _id: ID!
    name: String
    description: String
    topics: [String]
    contents: [Content]
    business: Business
    createdBy: User
    isPublic: Boolean
    isFeatured: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }
  input CollectionInput {
    name: String!
    description: String
    contents: [ContentInput]
    business: ID
    isPublic: Boolean
    isFeatured: Boolean
  }
  input ContentInput {
    source: contentSourceEnum
    metaData: JSON
  }
  enum updateCollectionActionEnum {
    rename
    redescribe
    addContents
    removeContents
  }
  type Query {
    # Get all collections for the user's business
    collections(id:ID limit: Int isPublic: Boolean): [Collection] @requireScope(scope: "collection:read") @requireBusinessAccess
  }

  type Mutation {
    # Create a new collection
    createCollection(collection: CollectionInput!): Collection @requireScope(scope: "collection:create") @requireBusinessAccess

    # Update an existing collection
    updateCollection(id: ID! action: updateCollectionActionEnum! name: String description: String removeContents: [ID] addContents: [ContentInput]): Collection @requireScope(scope: "collection:update") @requireBusinessAccess

    # Delete a collection
    deleteCollection(id: ID!): Boolean @requireScope(scope: "collection:delete") @requireBusinessAccess
  }
`; 