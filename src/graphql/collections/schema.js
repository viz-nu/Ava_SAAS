export const collectionTypeDefs = `#graphql
"""Supported content source types"""
enum contentSourceEnum {
  """Website URL content source"""
  website
  """YouTube video content source"""  
  youtube
  """File upload content source"""
  file
}

"""Status of content processing"""
enum contentStatusEnum {
  """Content successfully processed and active"""
  active
  """Content currently being processed"""
  loading
  """Content processing failed"""
  failed
}

"""Represents a piece of content in a collection"""
type Content {
  """Source type of the content"""
  source: contentSourceEnum
  """Additional metadata about the content"""
  metaData: JSON
  """Current processing status"""
  status: contentStatusEnum
  """Error message if processing failed"""
  error: String
}

"""Represents a collection of related content"""
type Collection {
  """Unique identifier"""
  _id: ID!
  """Display name of the collection"""
  name: String
  """Description of the collection's purpose/contents"""
  description: String
  """Topic tags for categorizing the collection"""
  topics: [String]
  """Content items in this collection"""
  contents: [Content]
  """Business that owns this collection"""
  business: Business
  """User who created the collection"""
  createdBy: User
  """Whether the collection is publicly accessible"""
  isPublic: Boolean
  """Whether the collection is highlighted/promoted"""
  isFeatured: Boolean
  """Creation timestamp"""
  createdAt: DateTime
  """Last update timestamp"""
  updatedAt: DateTime
}

"""Input type for creating collections"""
input CollectionInput {
  """Display name (required)"""
  name: String!
  """Description of the collection"""
  description: String
  """Initial content items"""
  contents: [ContentInput]
  """Business that will own the collection"""
  business: ID
  """Whether collection should be public"""
  isPublic: Boolean
  """Whether collection should be featured"""
  isFeatured: Boolean
}

"""Input type for adding content"""
input ContentInput {
  """Source type of the content"""
  source: contentSourceEnum
  """Additional metadata about the content"""
  metaData: JSON
}

"""Available actions for updating collections"""
enum updateCollectionActionEnum {
  """Change collection name"""
  rename
  """Update collection description"""
  redescribe
  """Add new content items"""
  addContents
  """Remove existing content items"""
  removeContents
}

type Query {
  """Get all collections for the user's business
  @param id - Optional ID to fetch specific collection
  @param limit - Maximum number of collections to return
  @param isPublic - Filter by public/private status"""
  collections(id:ID limit: Int isPublic: Boolean): [Collection] @requireScope(scope: "collection:read") @requireBusinessAccess
}

type Mutation {
  """Create a new collection
  @param collection - Collection data to create"""
  createCollection(collection: CollectionInput!): Collection @requireScope(scope: "collection:create") @requireBusinessAccess

  """Update an existing collection
  @param id - ID of collection to update
  @param action - Type of update to perform
  @param name - New name when renaming
  @param description - New description when redescribing
  @param removeContents - Content IDs to remove
  @param addContents - New content to add"""
  updateCollection(id: ID! action: updateCollectionActionEnum! name: String description: String removeContents: [ID] addContents: [ContentInput]): Collection @requireScope(scope: "collection:update") @requireBusinessAccess

  """Delete a collection
  @param id - ID of collection to delete"""
  deleteCollection(id: ID!): Boolean @requireScope(scope: "collection:delete") @requireBusinessAccess
}
`; 