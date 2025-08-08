export const authTypeDefs = `#graphql
  type AuthResponse {
    success: Boolean!
    message: String!
    data:JSON
  }

  type RegisterResponse {
    success: Boolean!
    message: String!
    user: User
    verificationRequired: Boolean
  }

  type PasswordResetResponse {
    success: Boolean!
    message: String!
    emailSent: Boolean
  }

  type TokenValidationResponse {
    valid: Boolean!
    user: User
    scopes: [String]
    business: Business
  }

  type EmailVerificationResponse {
    success: Boolean!
    message: String!
    user: User
  }

  type LogoutResponse {
    success: Boolean!
    message: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    businessName: String
    businessSector: String
    role: UserRole
  }

  input PasswordResetRequestInput {
    email: String!
  }

  input PasswordResetConfirmInput {
    token: String!
    newPassword: String!
  }

  input EmailVerificationInput {
    token: String!
  }

  input RefreshTokenInput {
    refreshToken: String!
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input UpdateProfileInput {
    name: String
    email: String
  }

  type Query {
    # Validate current token and get user info
    validateToken: TokenValidationResponse

    # Get current user profile (authenticated)
    me: User @requireScope(scope: "user:read")

    # Check if email is available for registration
    checkEmailAvailability(email: String!): Boolean
  }

  type Mutation {
    # User authentication
    login(credentials: LoginInput!): AuthResponse

    # Super admin login (special endpoint)
    superAdminLogin(credentials: LoginInput!): AuthResponse

    # User registration
    register(userData: RegisterInput!): RegisterResponse

    # Password management
    requestPasswordReset(request: PasswordResetRequestInput!): PasswordResetResponse
    resetPassword(resetData: PasswordResetConfirmInput!): PasswordResetResponse
    changePassword(passwordData: ChangePasswordInput!): AuthResponse @requireScope(scope: "user:update")

    # Email verification
    verifyEmail(verificationData: EmailVerificationInput!): EmailVerificationResponse
    resendVerificationEmail: PasswordResetResponse @requireScope(scope: "user:read")

    # Token management
    refreshToken(tokenData: RefreshTokenInput!): AuthResponse
    logout: LogoutResponse @requireScope(scope: "auth:logout")

    # Profile management
    updateProfile(profileData: UpdateProfileInput!): User @requireScope(scope: "user:update")

    # Admin user management (admin only)
    createUserByAdmin(userData: RegisterInput!): User @requireScope(scope: "admin:users") @requireBusinessAccess
    verifyUserByAdmin(userId: ID!): User @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")
    resetUserPasswordByAdmin(userId: ID!): PasswordResetResponse @requireScope(scope: "admin:users") @requireResourceOwnership(model: "User", idField: "userId")
  }
`; 