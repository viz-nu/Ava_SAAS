# Manager Management System

## Overview

The Manager Management System provides comprehensive capabilities for administrators to create, manage, and assign roles to managers within their business. This system includes both REST API endpoints and GraphQL operations with full scope-based authorization.

## Features

### 1. Manager Creation and Management
- Create new managers with custom scopes
- Update manager information and permissions
- Delete managers
- Assign managers to specific businesses

### 2. Role and Scope Management
- Assign roles (manager) to users
- Manage individual scopes for managers
- Bulk update scopes for multiple managers
- Scope validation and audit reports

### 3. User Status Management
- Activate/deactivate managers
- Verify manager accounts
- Reset manager passwords
- Send invitation emails

### 4. Audit and Reporting
- User audit trails
- Scope audit reports
- Manager activity tracking

## REST API Endpoints

### Base URL: `/api/v1/managers`

All endpoints require authentication and `admin:users` scope.

#### 1. Get All Managers
```http
GET /api/v1/managers?limit=10&businessId=123&isVerified=true&search=john
```

**Query Parameters:**
- `limit` (optional): Number of managers to return (default: 10)
- `businessId` (optional): Filter by business ID
- `isVerified` (optional): Filter by verification status
- `search` (optional): Search by name or email

**Response:**
```json
{
  "success": true,
  "message": "Managers retrieved successfully",
  "data": [
    {
      "_id": "manager_id",
      "name": "John Manager",
      "email": "john@example.com",
      "role": "manager",
      "scopes": ["business:read", "analytics:read"],
      "business": {
        "_id": "business_id",
        "name": "Example Business"
      },
      "isVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "metaData": {
    "total": 1,
    "limit": 10,
    "page": 1
  }
}
```

#### 2. Get Manager by ID
```http
GET /api/v1/managers/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Manager retrieved successfully",
  "data": {
    "_id": "manager_id",
    "name": "John Manager",
    "email": "john@example.com",
    "role": "manager",
    "scopes": ["business:read", "analytics:read"],
    "business": {
      "_id": "business_id",
      "name": "Example Business"
    },
    "isVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 3. Create Manager
```http
POST /api/v1/managers
```

**Request Body:**
```json
{
  "name": "Jane Manager",
  "email": "jane@example.com",
  "password": "securepassword123",
  "businessId": "business_id",
  "scopes": ["business:read", "analytics:read", "agent:read"],
  "sendInvite": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Manager created successfully",
  "data": {
    "_id": "new_manager_id",
    "name": "Jane Manager",
    "email": "jane@example.com",
    "role": "manager",
    "scopes": ["business:read", "analytics:read", "agent:read"],
    "business": {
      "_id": "business_id",
      "name": "Example Business"
    },
    "isVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 4. Update Manager
```http
PUT /api/v1/managers/:id
```

**Request Body:**
```json
{
  "name": "Jane Updated Manager",
  "email": "jane.updated@example.com",
  "scopes": ["business:read", "analytics:read", "agent:read", "collection:read"],
  "isVerified": true
}
```

#### 5. Delete Manager
```http
DELETE /api/v1/managers/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Manager deleted successfully",
  "data": null
}
```

#### 6. Assign Manager to Business
```http
POST /api/v1/managers/:id/assign-business
```

**Request Body:**
```json
{
  "businessId": "new_business_id"
}
```

#### 7. Update Manager Scopes
```http
PUT /api/v1/managers/:id/scopes
```

**Request Body:**
```json
{
  "scopes": ["business:read", "analytics:read"],
  "operation": "add"
}
```

**Operations:**
- `add`: Add scopes to existing ones
- `remove`: Remove scopes from existing ones
- `replace`: Replace all scopes with new ones

#### 8. Bulk Update Managers
```http
POST /api/v1/managers/bulk-update
```

**Request Body:**
```json
{
  "updates": [
    {
      "managerId": "manager_1",
      "scopes": ["business:read"],
      "operation": "add"
    },
    {
      "managerId": "manager_2",
      "scopes": ["analytics:read"],
      "operation": "remove"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bulk manager update completed",
  "data": {
    "successful": [
      {
        "managerId": "manager_1",
        "updatedScopes": ["business:read", "analytics:read"],
        "operation": "add"
      }
    ],
    "errors": [
      {
        "managerId": "manager_2",
        "error": "Manager not found"
      }
    ],
    "summary": {
      "total": 2,
      "successful": 1,
      "failed": 1
    }
  }
}
```

#### 9. Deactivate Manager
```http
POST /api/v1/managers/:id/deactivate
```

#### 10. Reactivate Manager
```http
POST /api/v1/managers/:id/reactivate
```

#### 11. Reset Manager Password
```http
POST /api/v1/managers/:id/reset-password
```

**Response:**
```json
{
  "success": true,
  "message": "Manager password reset successfully",
  "data": {
    "email": "manager@example.com",
    "newPassword": "abc123def"
  }
}
```

#### 12. Send Manager Invite
```http
POST /api/v1/managers/:id/send-invite
```

#### 13. Get Manager Audit
```http
GET /api/v1/managers/:id/audit?limit=10&action=login&from=2024-01-01&to=2024-12-31
```

## GraphQL Operations

### 1. Query Managers

```graphql
query GetManagers($businessId: ID, $limit: Int) {
  managers(businessId: $businessId, limit: $limit) {
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
    updatedAt
  }
}
```

### 2. Create Manager

```graphql
mutation CreateManager($user: UserInput!) {
  createManager(user: $user) {
    _id
    name
    email
    role
    scopes
    business {
      _id
      name
    }
    isVerified
    createdAt
  }
}
```

**Variables:**
```json
{
  "user": {
    "name": "New Manager",
    "email": "newmanager@example.com",
    "password": "securepassword123",
    "role": "manager",
    "business": "business_id",
    "scopes": ["business:read", "analytics:read"]
  }
}
```

### 3. Update Manager

```graphql
mutation UpdateManager($id: ID!, $user: UserUpdateInput!) {
  updateUser(id: $id, user: $user) {
    _id
    name
    email
    role
    scopes
    business {
      _id
      name
    }
    isVerified
    updatedAt
  }
}
```

### 4. Assign Role

```graphql
mutation AssignRole($userId: ID!, $role: UserRole!) {
  assignRole(userId: $userId, role: $role) {
    _id
    name
    email
    role
    scopes
    updatedAt
  }
}
```

### 5. Update User Scopes

```graphql
mutation UpdateUserScopes($userId: ID!, $scopeUpdate: ScopeUpdateInput!) {
  updateUserScopes(userId: $userId, scopeUpdate: $scopeUpdate) {
    _id
    name
    email
    scopes
    updatedAt
  }
}
```

**Variables:**
```json
{
  "userId": "manager_id",
  "scopeUpdate": {
    "scopes": ["business:read", "analytics:read"],
    "operation": "add"
  }
}
```

### 6. Get User Scope Audit

```graphql
query GetUserScopeAudit($userId: ID!) {
  userScopeAudit(userId: $userId) {
    userId
    role
    currentScopes
    operationAccess
    missingScopes
    recommendations
  }
}
```

### 7. Get Available Scopes

```graphql
query GetAvailableScopes {
  availableScopes {
    scope
    description
  }
}
```

### 8. Get Default Scopes for Role

```graphql
query GetDefaultScopesForRole($role: UserRole!) {
  defaultScopesForRole(role: $role) {
    scope
    description
  }
}
```

### 9. Validate Scopes

```graphql
query ValidateScopes($scopes: [String!]!) {
  validateScopes(scopes: $scopes) {
    isValid
    invalidScopes
    validScopes
  }
}
```

## Manager Scopes

### Default Manager Scopes
Managers automatically receive these scopes:

```javascript
[
  'business:read',
  'business:view_analytics',
  'agent:read',
  'agent:test',
  'agent:view_conversations',
  'collection:read',
  'collection:upload_files',
  'channel:read',
  'action:read',
  'action:test',
  'conversation:read',
  'conversation:export',
  'conversation:analyze',
  'ticket:read',
  'ticket:create',
  'ticket:update',
  'analytics:read',
  'analytics:export',
  'file:upload',
  'file:download',
  'file:share',
  'template:read',
  'template:subscribe',
  'webhook:read',
  'subscription:read',
  'auth:login',
  'auth:logout',
  'auth:refresh',
  'user:read',
  'user:update'
]
```

### Custom Scope Assignment
Admins can assign additional scopes to managers based on their specific needs:

```javascript
// Example: Give a manager additional analytics capabilities
const additionalScopes = [
  'analytics:custom_reports',
  'analytics:real_time',
  'business:export_data'
];
```

## Email Templates

### Manager Invitation Email
```html
<h2>Welcome to {{business.name}}!</h2>
<p>You have been invited to join {{business.name}} as a manager on the Ava SAAS platform.</p>
<p>Please click the link below to set up your account:</p>
<a href="{{inviteUrl}}">Set Up Account</a>
<p>If you have any questions, please contact your administrator.</p>
```

### Password Reset Email
```html
<h2>Password Reset</h2>
<p>Your password has been reset by an administrator.</p>
<p>Your new password is: <strong>{{newPassword}}</strong></p>
<p>Please change this password after your next login.</p>
<p>If you didn't request this reset, please contact your administrator immediately.</p>
```

## Security Considerations

### 1. Scope Validation
- All scopes are validated against the predefined list
- Invalid scopes are rejected with clear error messages
- Scope changes are logged for audit purposes

### 2. Business Isolation
- Managers can only access resources within their assigned business
- Cross-business access is prevented
- Business assignment is validated

### 3. Password Security
- Passwords are hashed using bcrypt with salt rounds of 12
- Password reset emails are sent securely
- Temporary passwords are generated randomly

### 4. Audit Trail
- All manager operations are logged
- Scope changes are tracked
- User activity is monitored

## Usage Examples

### 1. Create a Manager with Custom Scopes

```javascript
// REST API
const response = await fetch('/api/v1/managers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    name: 'Analytics Manager',
    email: 'analytics@example.com',
    businessId: 'business_123',
    scopes: [
      'business:read',
      'analytics:read',
      'analytics:custom_reports',
      'analytics:export',
      'conversation:read',
      'conversation:analyze'
    ],
    sendInvite: true
  })
});

// GraphQL
const CREATE_MANAGER = `
  mutation CreateManager($user: UserInput!) {
    createManager(user: $user) {
      _id
      name
      email
      scopes
      business { name }
    }
  }
`;

const result = await graphqlClient.request(CREATE_MANAGER, {
  user: {
    name: 'Analytics Manager',
    email: 'analytics@example.com',
    role: 'manager',
    business: 'business_123',
    scopes: ['analytics:read', 'analytics:custom_reports']
  }
});
```

### 2. Bulk Update Manager Scopes

```javascript
const response = await fetch('/api/v1/managers/bulk-update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    updates: [
      {
        managerId: 'manager_1',
        scopes: ['analytics:custom_reports'],
        operation: 'add'
      },
      {
        managerId: 'manager_2',
        scopes: ['agent:delete'],
        operation: 'remove'
      }
    ]
  })
});
```

### 3. Get Manager Audit Report

```javascript
const response = await fetch('/api/v1/managers/manager_123/audit?limit=50', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});

const auditData = await response.json();
console.log('Manager activity:', auditData.data);
```

## Best Practices

### 1. Scope Management
- Start with default manager scopes
- Add specific scopes based on job requirements
- Regularly review and audit scope assignments
- Remove unnecessary scopes promptly

### 2. Manager Creation
- Always send invitation emails for new managers
- Set appropriate initial scopes
- Verify manager accounts after setup
- Monitor manager activity

### 3. Security
- Regularly rotate manager passwords
- Monitor for unusual activity
- Keep audit logs for compliance
- Implement proper error handling

### 4. Communication
- Send clear invitation emails
- Provide onboarding documentation
- Establish clear role expectations
- Maintain open communication channels

This manager management system provides comprehensive capabilities for administrators to effectively manage their team while maintaining security and proper access control. 