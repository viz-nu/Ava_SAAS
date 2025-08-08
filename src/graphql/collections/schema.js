export const collectionTypeDefs = `#graphql
  type Collection {
    _id: ID!
    name: String
    description: String
    type: String
    content: [JSON]
    business: Business
    createdBy: User
    isPublic: Boolean
    permissions: [Permission]
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Permission {
    user: User
    role: String
    canRead: Boolean
    canWrite: Boolean
    canDelete: Boolean
  }

  input CollectionInput {
    name: String!
    description: String
    type: String
    content: [JSON]
    business: ID
    isPublic: Boolean
    permissions: [PermissionInput]
  }

  input PermissionInput {
    user: ID
    role: String
    canRead: Boolean
    canWrite: Boolean
    canDelete: Boolean
  }

  type Query {
    # Get all collections for the user's business
    collections(
      limit: Int
      type: String
      isPublic: Boolean
      business: ID
    ): [Collection] @requireScope(scope: "collection:read") @requireBusinessAccess

    # Get a specific collection by ID
    collection(id: ID!): Collection @requireScope(scope: "collection:read") @requireResourceOwnership(model: "Collection", idField: "id")

    # Get public collections (no auth required)
    publicCollections(
      limit: Int
      type: String
    ): [Collection]
  }

  type Mutation {
    # Create a new collection
    createCollection(collection: CollectionInput!): Collection @requireScope(scope: "collection:create") @requireBusinessAccess

    # Update an existing collection
    updateCollection(id: ID!, collection: CollectionInput!): Collection @requireScope(scope: "collection:update") @requireResourceOwnership(model: "Collection", idField: "id")

    # Delete a collection
    deleteCollection(id: ID!): Boolean @requireScope(scope: "collection:delete") @requireResourceOwnership(model: "Collection", idField: "id")

    # Upload files to collection
    uploadToCollection(collectionId: ID!, files: [JSON]!): Collection @requireScope(scope: "collection:upload_files") @requireResourceOwnership(model: "Collection", idField: "collectionId")

    # Manage collection permissions
    updateCollectionPermissions(collectionId: ID!, permissions: [PermissionInput]!): Collection @requireScope(scope: "collection:manage_permissions") @requireResourceOwnership(model: "Collection", idField: "collectionId")
  }
`; 