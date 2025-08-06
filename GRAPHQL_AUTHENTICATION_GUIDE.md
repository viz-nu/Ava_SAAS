# GraphQL Authentication Guide

## Overview

The GraphQL authentication system provides comprehensive user authentication and authorization capabilities through GraphQL mutations and queries. This system includes login, registration, password management, email verification, and token management.

## Authentication Operations

### 1. User Login

**Mutation:**
```graphql
mutation Login($credentials: LoginInput!) {
  login(credentials: $credentials) {
    success
    message
    token
    refreshToken
    user {
      _id
      name
      email
      role
      scopes
      business {
        _id
        name
        sector
      }
      isVerified
    }
    expiresIn
  }
}
```

**Variables:**
```json
{
  "credentials": {
    "email": "user@example.com",
    "password": "securepassword123"
  }
}
```

**Response:**
```json
{
  "data": {
    "login": {
      "success": true,
      "message": "Login successful",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "user@example.com",
        "role": "manager",
        "scopes": ["business:read", "analytics:read"],
        "business": {
          "_id": "business_id",
          "name": "Example Business",
          "sector": "Technology"
        },
        "isVerified": true
      },
      "expiresIn": 86400
    }
  }
}
```

### 2. Super Admin Login

**Mutation:**
```graphql
mutation SuperAdminLogin($credentials: LoginInput!) {
  superAdminLogin(credentials: $credentials) {
    success
    message
    token
    refreshToken
    user {
      _id
      name
      email
      role
      scopes
      business {
        _id
        name
        sector
      }
      isVerified
    }
    expiresIn
  }
}
```

### 3. User Registration

**Mutation:**
```graphql
mutation Register($userData: RegisterInput!) {
  register(userData: $userData) {
    success
    message
    user {
      _id
      name
      email
      role
      business {
        _id
        name
        sector
      }
      isVerified
    }
    verificationRequired
  }
}
```

**Variables:**
```json
{
  "userData": {
    "name": "Jane Manager",
    "email": "jane@example.com",
    "password": "securepassword123",
    "businessName": "New Business",
    "businessSector": "Technology",
    "role": "manager"
  }
}
```

**Response:**
```json
{
  "data": {
    "register": {
      "success": true,
      "message": "Registration successful. Please check your email to verify your account.",
      "user": {
        "_id": "new_user_id",
        "name": "Jane Manager",
        "email": "jane@example.com",
        "role": "manager",
        "business": {
          "_id": "new_business_id",
          "name": "New Business",
          "sector": "Technology"
        },
        "isVerified": false
      },
      "verificationRequired": true
    }
  }
}
```

### 4. Email Verification

**Mutation:**
```graphql
mutation VerifyEmail($verificationData: EmailVerificationInput!) {
  verifyEmail(verificationData: $verificationData) {
    success
    message
    user {
      _id
      name
      email
      role
      isVerified
    }
  }
}
```

**Variables:**
```json
{
  "verificationData": {
    "token": "verification_token_from_email"
  }
}
```

### 5. Password Reset Request

**Mutation:**
```graphql
mutation RequestPasswordReset($request: PasswordResetRequestInput!) {
  requestPasswordReset(request: $request) {
    success
    message
    emailSent
  }
}
```

**Variables:**
```json
{
  "request": {
    "email": "user@example.com"
  }
}
```

### 6. Password Reset Confirmation

**Mutation:**
```graphql
mutation ResetPassword($resetData: PasswordResetConfirmInput!) {
  resetPassword(resetData: $resetData) {
    success
    message
    emailSent
  }
}
```

**Variables:**
```json
{
  "resetData": {
    "token": "reset_token_from_email",
    "newPassword": "newsecurepassword123"
  }
}
```

### 7. Change Password (Authenticated)

**Mutation:**
```graphql
mutation ChangePassword($passwordData: ChangePasswordInput!) {
  changePassword(passwordData: $passwordData) {
    success
    message
    token
    refreshToken
    user {
      _id
      name
      email
      role
      scopes
    }
    expiresIn
  }
}
```

**Variables:**
```json
{
  "passwordData": {
    "currentPassword": "oldpassword123",
    "newPassword": "newpassword123"
  }
}
```

### 8. Token Refresh

**Mutation:**
```graphql
mutation RefreshToken($tokenData: RefreshTokenInput!) {
  refreshToken(tokenData: $tokenData) {
    success
    message
    token
    refreshToken
    user {
      _id
      name
      email
      role
      scopes
    }
    expiresIn
  }
}
```

**Variables:**
```json
{
  "tokenData": {
    "refreshToken": "refresh_token_from_previous_login"
  }
}
```

### 9. Logout

**Mutation:**
```graphql
mutation Logout {
  logout {
    success
    message
  }
}
```

### 10. Update Profile

**Mutation:**
```graphql
mutation UpdateProfile($profileData: UpdateProfileInput!) {
  updateProfile(profileData: $profileData) {
    _id
    name
    email
    role
    business {
      _id
      name
      sector
    }
    isVerified
    updatedAt
  }
}
```

**Variables:**
```json
{
  "profileData": {
    "name": "Updated Name",
    "email": "updated@example.com"
  }
}
```

## Queries

### 1. Validate Token

**Query:**
```graphql
query ValidateToken {
  validateToken {
    valid
    user {
      _id
      name
      email
      role
      scopes
    }
    scopes
    business {
      _id
      name
      sector
    }
  }
}
```

### 2. Get Current User

**Query:**
```graphql
query GetCurrentUser {
  me {
    _id
    name
    email
    role
    scopes
    business {
      _id
      name
      sector
    }
    subscription {
      _id
      name
    }
    isVerified
    createdAt
    updatedAt
  }
}
```

### 3. Check Email Availability

**Query:**
```graphql
query CheckEmailAvailability($email: String!) {
  checkEmailAvailability(email: $email)
}
```

**Variables:**
```json
{
  "email": "user@example.com"
}
```

## Admin Operations

### 1. Create User by Admin

**Mutation:**
```graphql
mutation CreateUserByAdmin($userData: RegisterInput!) {
  createUserByAdmin(userData: $userData) {
    _id
    name
    email
    role
    scopes
    business {
      _id
      name
      sector
    }
    isVerified
    createdAt
  }
}
```

### 2. Verify User by Admin

**Mutation:**
```graphql
mutation VerifyUserByAdmin($userId: ID!) {
  verifyUserByAdmin(userId: $userId) {
    _id
    name
    email
    role
    isVerified
  }
}
```

### 3. Reset User Password by Admin

**Mutation:**
```graphql
mutation ResetUserPasswordByAdmin($userId: ID!) {
  resetUserPasswordByAdmin(userId: $userId) {
    success
    message
    emailSent
  }
}
```

## Usage Examples

### 1. Complete Login Flow

```javascript
// 1. Login
const LOGIN_MUTATION = `
  mutation Login($credentials: LoginInput!) {
    login(credentials: $credentials) {
      success
      message
      token
      refreshToken
      user {
        _id
        name
        email
        role
        scopes
        business { name }
      }
      expiresIn
    }
  }
`;

const loginResult = await graphqlClient.request(LOGIN_MUTATION, {
  credentials: {
    email: 'user@example.com',
    password: 'password123'
  }
});

// Store tokens
localStorage.setItem('token', loginResult.login.token);
localStorage.setItem('refreshToken', loginResult.login.refreshToken);

// 2. Set authorization header for future requests
graphqlClient.setHeader('Authorization', `Bearer ${loginResult.login.token}`);
```

### 2. Token Refresh Flow

```javascript
// When token expires, use refresh token
const REFRESH_MUTATION = `
  mutation RefreshToken($tokenData: RefreshTokenInput!) {
    refreshToken(tokenData: $tokenData) {
      success
      token
      refreshToken
      user { _id name email role }
      expiresIn
    }
  }
`;

const refreshResult = await graphqlClient.request(REFRESH_MUTATION, {
  tokenData: {
    refreshToken: localStorage.getItem('refreshToken')
  }
});

// Update stored tokens
localStorage.setItem('token', refreshResult.refreshToken.token);
localStorage.setItem('refreshToken', refreshResult.refreshToken.refreshToken);
```

### 3. Registration with Business Creation

```javascript
const REGISTER_MUTATION = `
  mutation Register($userData: RegisterInput!) {
    register(userData: $userData) {
      success
      message
      user {
        _id
        name
        email
        role
        business { name sector }
        isVerified
      }
      verificationRequired
    }
  }
`;

const registerResult = await graphqlClient.request(REGISTER_MUTATION, {
  userData: {
    name: 'New Manager',
    email: 'manager@newbusiness.com',
    password: 'securepassword123',
    businessName: 'New Business Inc',
    businessSector: 'Technology',
    role: 'manager'
  }
});

if (registerResult.register.verificationRequired) {
  console.log('Please check your email to verify your account');
}
```

### 4. Password Reset Flow

```javascript
// 1. Request password reset
const REQUEST_RESET = `
  mutation RequestPasswordReset($request: PasswordResetRequestInput!) {
    requestPasswordReset(request: $request) {
      success
      message
      emailSent
    }
  }
`;

await graphqlClient.request(REQUEST_RESET, {
  request: { email: 'user@example.com' }
});

// 2. User receives email with reset token
// 3. User clicks link and enters new password
const RESET_PASSWORD = `
  mutation ResetPassword($resetData: PasswordResetConfirmInput!) {
    resetPassword(resetData: $resetData) {
      success
      message
    }
  }
`;

const resetResult = await graphqlClient.request(RESET_PASSWORD, {
  resetData: {
    token: 'token_from_email',
    newPassword: 'newpassword123'
  }
});
```

### 5. Profile Management

```javascript
// Update profile
const UPDATE_PROFILE = `
  mutation UpdateProfile($profileData: UpdateProfileInput!) {
    updateProfile(profileData: $profileData) {
      _id
      name
      email
      role
      business { name }
      updatedAt
    }
  }
`;

const updateResult = await graphqlClient.request(UPDATE_PROFILE, {
  profileData: {
    name: 'Updated Name',
    email: 'updated@example.com'
  }
});

// Change password
const CHANGE_PASSWORD = `
  mutation ChangePassword($passwordData: ChangePasswordInput!) {
    changePassword(passwordData: $passwordData) {
      success
      message
      token
      refreshToken
      user { _id name email }
    }
  }
`;

const changeResult = await graphqlClient.request(CHANGE_PASSWORD, {
  passwordData: {
    currentPassword: 'oldpassword',
    newPassword: 'newpassword123'
  }
});
```

## Error Handling

### Common Error Responses

**Invalid Credentials:**
```json
{
  "data": {
    "login": {
      "success": false,
      "message": "Invalid email or password",
      "token": null,
      "refreshToken": null,
      "user": null,
      "expiresIn": null
    }
  }
}
```

**Email Not Verified:**
```json
{
  "data": {
    "login": {
      "success": false,
      "message": "Please verify your email before logging in",
      "token": null,
      "refreshToken": null,
      "user": null,
      "expiresIn": null
    }
  }
}
```

**Email Already Exists:**
```json
{
  "data": {
    "register": {
      "success": false,
      "message": "User with this email already exists",
      "user": null,
      "verificationRequired": false
    }
  }
}
```

**Invalid Token:**
```json
{
  "errors": [
    {
      "message": "Invalid refresh token",
      "extensions": {
        "code": "BAD_USER_INPUT"
      }
    }
  ]
}
```

## Security Features

### 1. Token Management
- JWT tokens with 24-hour expiration
- Refresh tokens with 7-day expiration
- Secure token storage and validation
- Automatic token refresh mechanism

### 2. Password Security
- bcrypt hashing with salt rounds of 12
- Password strength validation
- Secure password reset flow
- Current password verification for changes

### 3. Email Verification
- Secure email verification tokens
- 24-hour token expiration
- Resend verification capability
- Admin verification override

### 4. Business Isolation
- Users can only access their business resources
- Cross-business access prevention
- Business assignment validation

### 5. Scope-Based Authorization
- Fine-grained permission control
- Role-based scope assignment
- Dynamic scope validation
- Audit trail for scope changes

## Best Practices

### 1. Token Management
- Store tokens securely (localStorage/sessionStorage)
- Implement automatic token refresh
- Clear tokens on logout
- Handle token expiration gracefully

### 2. Error Handling
- Implement proper error handling for all auth operations
- Show user-friendly error messages
- Log authentication errors for monitoring
- Handle network errors appropriately

### 3. Security
- Use HTTPS for all authentication requests
- Implement rate limiting for auth endpoints
- Monitor for suspicious activity
- Regular security audits

### 4. User Experience
- Provide clear feedback for all operations
- Implement loading states
- Handle edge cases gracefully
- Maintain session state appropriately

This GraphQL authentication system provides a comprehensive, secure, and user-friendly authentication experience with full integration into the scope-based authorization system. 