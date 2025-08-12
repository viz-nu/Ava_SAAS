export const userTypeDefs = `#graphql
  """User role enum defining permission levels"""
  enum UserRole {
    superAdmin
    admin
    manager
  }

  """Allowed roles when creating new users"""
  enum UserCreatingRole {
    admin
    manager
  }

  """Input type for creating new users"""
  input UserInput {
    """User's full name"""
    name: String!
    """User's email address"""
    email: String!
    """User's password"""
    password: String!
    """Role to assign to new user"""
    role: UserCreatingRole!
    """Permission scopes to grant"""
    scopes: [String]
  }

  """Input type for updating existing users"""
  input UserUpdateInput {
    """Updated full name"""
    name: String
    """Updated email address"""
    email: String
    """Updated role"""
    role: UserRole
    """Updated permission scopes"""
    scopes: [String]
  }

  # input ScopeUpdateInput {
  #   scopes: [String]!
  #   operation: ScopeOperation!
  # }

  # enum ScopeOperation {
  #   add
  #   remove
  #   replace
  # }

  # input BulkUserUpdateInput {
  #   userId: ID!
  #   scopes: [String]!
  #   operation: ScopeOperation!
  # }

  type Query {
    """Get current user profile"""
    me: User @requireScope(scope: "user:read")

    """Get all users (admin only)"""
    users( id: ID limit: Int role: UserRole isVerified: Boolean): [User] @requireScope(scope: "admin:users") @requireBusinessAccess


    # # Get users by business
    # businessUsers(
    #   businessId: ID
    #   role: UserRole
    #   limit: Int
    # ): [User] @requireScope(scope: "admin:users") @requireBusinessAccess

    # # Get managers for a business
    # managers(
    #   businessId: ID
    #   limit: Int
    # ): [User] @requireScope(scope: "admin:users") @requireBusinessAccess

    # # Get all available scopes
    # availableScopes: [ScopeInfo] @requireScope(scope: "admin:users")

    # # Get scopes by category
    # scopesByCategory: JSON @requireScope(scope: "admin:users")

    # # Get default scopes for a role
    # defaultScopesForRole(role: UserRole!): [ScopeInfo] @requireScope(scope: "admin:users")

    # # Validate scopes
    # validateScopes(scopes: [String]!): ScopeValidation @requireScope(scope: "admin:users")
  }

  type Mutation {
    """Create a new user (admin only)"""
    createUser(user: UserInput!): User @requireScope(scope: "admin:users") @requireBusinessAccess

    """Update an existing user"""
    updateUser(id: ID!, user: UserUpdateInput!): User @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "id",creatorIndependent:true)

    """Delete a user"""
    deleteUser(id: ID!): Boolean @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "id",creatorIndependent:true)

  #   # Verify user email
  #   verifyUser(userId: ID!): User @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")

  #   # Deactivate user
  #   deactivateUser(userId: ID!): User @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")

  #   # Reactivate user
  #   reactivateUser(userId: ID!): User @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")

  #   # Reset user password (admin only)
  #   resetUserPassword(userId: ID!): Boolean @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")

  #   # Send password reset email
  #   sendPasswordResetEmail(email: String!): Boolean @requireScope(scope: "admin:users")
  }
`; 