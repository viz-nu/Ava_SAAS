# GraphQL Scope-Based Authorization System

## Overview

The GraphQL API implements a comprehensive scope-based authorization system using GraphQL directives. This system provides fine-grained access control for all GraphQL operations while maintaining the flexibility and power of GraphQL.

## GraphQL Directives

### Available Directives

#### 1. `@requireScope(scope: String!)`
Requires a specific scope to access the field.

```graphql
type Query {
  agents: [Agent] @requireScope(scope: "agent:read")
}
```

#### 2. `@requireAnyScope(scopes: [String!]!)`
Requires any of the provided scopes to access the field.

```graphql
type Query {
  analytics: [Analytics] @requireAnyScope(scopes: ["analytics:read", "analytics:custom_reports"])
}
```

#### 3. `@requireAllScopes(scopes: [String!]!)`
Requires all of the provided scopes to access the field.

```graphql
type Mutation {
  createAgent(agent: AgentInput!): Agent @requireAllScopes(scopes: ["agent:create", "business:read"])
}
```

#### 4. `@requireBusinessAccess`
Requires the user to have business access (belong to a business or be a super admin).

```graphql
type Query {
  business: Business @requireBusinessAccess
}
```

#### 5. `@requireResourceOwnership(model: String!, idField: String, ownerField: String)`
Requires the user to own the resource or belong to the same business.

```graphql
type Mutation {
  updateAgent(id: ID!, agent: AgentInput!): Agent @requireResourceOwnership(model: "Agent", idField: "id")
}
```

## GraphQL Schemas

### 1. Agent Schema

```graphql
type Agent {
  _id: ID!
  appearance: Appearance
  personalInfo: PersonalInfo
  collections: [JSON]
  channels: [JSON]
  actions: [JSON]
  business: Business
  analysisMetrics: JSON
  facets: [String]
  createdBy: User
  isPublic: Boolean
  isFeatured: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

type Query {
  # Get all agents for the user's business
  agents(
    limit: Int
    isPublic: Boolean
    isFeatured: Boolean
    business: ID
  ): [Agent] @requireScope(scope: "agent:read") @requireBusinessAccess

  # Get a specific agent by ID
  agent(id: ID!): Agent @requireScope(scope: "agent:read") @requireResourceOwnership(model: "Agent", idField: "id")

  # Get public agents (no auth required)
  publicAgents(
    limit: Int
    isFeatured: Boolean
  ): [Agent]

  # Get featured agents (no auth required)
  featuredAgents(
    limit: Int
  ): [Agent]
}

type Mutation {
  # Create a new agent
  createAgent(agent: AgentInput!): Agent @requireScope(scope: "agent:create") @requireBusinessAccess

  # Update an existing agent
  updateAgent(id: ID!, agent: AgentInput!): Agent @requireScope(scope: "agent:update") @requireResourceOwnership(model: "Agent", idField: "id")

  # Delete an agent
  deleteAgent(id: ID!): Boolean @requireScope(scope: "agent:delete") @requireResourceOwnership(model: "Agent", idField: "id")

  # Test agent prompt generation
  generatePrompt(prompt: String!, agentId: ID!): String @requireScope(scope: "agent:manage_prompts") @requireResourceOwnership(model: "Agent", idField: "agentId")

  # Deploy agent to channel
  deployAgent(agentId: ID!, channelId: ID!): Boolean @requireScope(scope: "agent:deploy") @requireResourceOwnership(model: "Agent", idField: "agentId")

  # Test agent response
  testAgent(agentId: ID!, message: String!): String @requireScope(scope: "agent:test") @requireResourceOwnership(model: "Agent", idField: "agentId")
}
```

### 2. Collection Schema

```graphql
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
```

### 3. Business Schema

```graphql
type Business {
  _id: ID!
  name: String
  logoURL: String
  facts: [String]
  quickQuestions: [QuickQuestion]
  sector: String
  tagline: String
  address: String
  description: String
  MAX_DAYS: Int
  contact: Contact
  createdBy: User
  members: [User]
  documents: [JSON]
  analytics: Analytics
  createdAt: DateTime
  updatedAt: DateTime
}

type Query {
  # Get business information
  business(id: ID): Business @requireScope(scope: "business:read") @requireBusinessAccess

  # Get business analytics
  businessAnalytics(businessId: ID): Analytics @requireScope(scope: "business:view_analytics") @requireBusinessAccess

  # Get business members
  businessMembers(businessId: ID): [User] @requireScope(scope: "business:manage_members") @requireBusinessAccess

  # Export business data
  exportBusinessData(businessId: ID, format: String): String @requireScope(scope: "business:export_data") @requireBusinessAccess
}

type Mutation {
  # Create a new business (super admin only)
  createBusiness(business: BusinessInput!): Business @requireScope(scope: "business:create")

  # Update business information
  updateBusiness(id: ID!, business: BusinessInput!): Business @requireScope(scope: "business:update") @requireResourceOwnership(model: "Business", idField: "id")

  # Delete a business (super admin only)
  deleteBusiness(id: ID!): Boolean @requireScope(scope: "business:delete") @requireResourceOwnership(model: "Business", idField: "id")

  # Add member to business
  addBusinessMember(businessId: ID!, userId: ID!, role: String): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")

  # Remove member from business
  removeBusinessMember(businessId: ID!, userId: ID!): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")

  # Update member role
  updateMemberRole(businessId: ID!, userId: ID!, role: String!): Business @requireScope(scope: "business:manage_members") @requireResourceOwnership(model: "Business", idField: "businessId")
}
```

### 4. Analytics Schema

```graphql
type Analytics {
  _id: ID!
  business: Business
  type: String
  data: JSON
  filters: JSON
  createdAt: DateTime
  updatedAt: DateTime
}

type Dashboard {
  _id: ID!
  name: String
  business: Business
  widgets: [Widget]
  layout: JSON
  isDefault: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

type Report {
  _id: ID!
  name: String
  business: Business
  type: String
  filters: JSON
  data: JSON
  format: String
  schedule: Schedule
  createdAt: DateTime
  updatedAt: DateTime
}

type Query {
  # Get analytics data
  analytics(
    businessId: ID
    type: String
    filters: JSON
    from: DateTime
    to: DateTime
  ): [Analytics] @requireScope(scope: "analytics:read") @requireBusinessAccess

  # Get dashboard
  dashboard(id: ID): Dashboard @requireScope(scope: "analytics:read") @requireBusinessAccess

  # Get user's dashboards
  dashboards(businessId: ID): [Dashboard] @requireScope(scope: "analytics:read") @requireBusinessAccess

  # Get reports
  reports(
    businessId: ID
    type: String
    isActive: Boolean
  ): [Report] @requireScope(scope: "analytics:read") @requireBusinessAccess

  # Get specific report
  report(id: ID!): Report @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Report", idField: "id")

  # Export analytics data
  exportAnalytics(
    businessId: ID
    type: String
    format: String
    filters: JSON
  ): String @requireScope(scope: "analytics:export") @requireBusinessAccess

  # Get real-time analytics
  realTimeAnalytics(
    businessId: ID
    type: String
  ): JSON @requireScope(scope: "analytics:real_time") @requireBusinessAccess
}

type Mutation {
  # Create custom report
  createReport(report: ReportInput!): Report @requireScope(scope: "analytics:custom_reports") @requireBusinessAccess

  # Update report
  updateReport(id: ID!, report: ReportInput!): Report @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "id")

  # Delete report
  deleteReport(id: ID!): Boolean @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "id")

  # Create dashboard
  createDashboard(dashboard: DashboardInput!): Dashboard @requireScope(scope: "analytics:read") @requireBusinessAccess

  # Update dashboard
  updateDashboard(id: ID!, dashboard: DashboardInput!): Dashboard @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Dashboard", idField: "id")

  # Delete dashboard
  deleteDashboard(id: ID!): Boolean @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Dashboard", idField: "id")

  # Schedule report generation
  scheduleReport(reportId: ID!, schedule: ScheduleInput!): Report @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "reportId")
}
```

## Usage Examples

### 1. Query Agents (Requires Authentication and Scope)

```graphql
query GetAgents {
  agents(limit: 10, isPublic: false) {
    _id
    personalInfo {
      name
      systemPrompt
    }
    business {
      name
      sector
    }
    createdAt
  }
}
```

**Headers Required:**
```
Authorization: Bearer <access_token>
```

### 2. Create Agent (Requires Multiple Scopes)

```graphql
mutation CreateAgent($agent: AgentInput!) {
  createAgent(agent: $agent) {
    _id
    personalInfo {
      name
      systemPrompt
    }
    business {
      name
    }
    createdAt
  }
}
```

**Variables:**
```json
{
  "agent": {
    "personalInfo": {
      "name": "Customer Support Agent",
      "systemPrompt": "You are a helpful customer support agent...",
      "model": "gpt-4",
      "temperature": 0.7
    },
    "isPublic": false
  }
}
```

### 3. Update Agent (Requires Resource Ownership)

```graphql
mutation UpdateAgent($id: ID!, $agent: AgentInput!) {
  updateAgent(id: $id, agent: $agent) {
    _id
    personalInfo {
      name
      systemPrompt
    }
    updatedAt
  }
}
```

### 4. Get Business Analytics (Requires Business Access)

```graphql
query GetBusinessAnalytics {
  businessAnalytics {
    lastUpdated
    engagementOverview {
      agentWiseBreakdown {
        agent {
          name
        }
        totalConversations
        averageSessionDurationInSeconds
      }
    }
    creditsUsage {
      knowledgeCosts {
        totalTokens
        totalCost
      }
      chatCosts {
        totalTokens
        totalCost
      }
    }
  }
}
```

### 5. Create Custom Report (Requires Custom Reports Scope)

```graphql
mutation CreateReport($report: ReportInput!) {
  createReport(report: $report) {
    _id
    name
    type
    format
    schedule {
      frequency
      time
      isActive
    }
    createdAt
  }
}
```

**Variables:**
```json
{
  "report": {
    "name": "Monthly Conversation Report",
    "type": "conversation_analytics",
    "format": "pdf",
    "schedule": {
      "frequency": "monthly",
      "time": "09:00",
      "dayOfMonth": 1,
      "isActive": true
    }
  }
}
```

## Error Handling

### Authentication Errors

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

### Authorization Errors

```json
{
  "errors": [
    {
      "message": "Insufficient permissions. Required scope: agent:create",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredScope": "agent:create"
      }
    }
  ]
}
```

### Resource Ownership Errors

```json
{
  "errors": [
    {
      "message": "Access denied to this resource",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

### Business Access Errors

```json
{
  "errors": [
    {
      "message": "Business access required",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

## Testing GraphQL Queries

### 1. Using GraphQL Playground

Access the GraphQL playground at `/graphql` and include the authorization header:

```http
Authorization: Bearer <your_access_token>
```

### 2. Using cURL

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_access_token>" \
  -d '{
    "query": "query { agents(limit: 5) { _id personalInfo { name } } }"
  }' \
  http://localhost:5000/graphql
```

### 3. Using JavaScript/Node.js

```javascript
const response = await fetch('/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    query: `
      query GetAgents {
        agents(limit: 10) {
          _id
          personalInfo {
            name
            systemPrompt
          }
        }
      }
    `
  })
});

const data = await response.json();
```

## Scope Requirements by Operation

### Agent Operations
- `agents` query: `agent:read` + business access
- `agent` query: `agent:read` + resource ownership
- `createAgent` mutation: `agent:create` + business access
- `updateAgent` mutation: `agent:update` + resource ownership
- `deleteAgent` mutation: `agent:delete` + resource ownership
- `generatePrompt` mutation: `agent:manage_prompts` + resource ownership
- `deployAgent` mutation: `agent:deploy` + resource ownership
- `testAgent` mutation: `agent:test` + resource ownership

### Collection Operations
- `collections` query: `collection:read` + business access
- `collection` query: `collection:read` + resource ownership
- `createCollection` mutation: `collection:create` + business access
- `updateCollection` mutation: `collection:update` + resource ownership
- `deleteCollection` mutation: `collection:delete` + resource ownership
- `uploadToCollection` mutation: `collection:upload_files` + resource ownership
- `updateCollectionPermissions` mutation: `collection:manage_permissions` + resource ownership

### Business Operations
- `business` query: `business:read` + business access
- `businessAnalytics` query: `business:view_analytics` + business access
- `businessMembers` query: `business:manage_members` + business access
- `exportBusinessData` query: `business:export_data` + business access
- `createBusiness` mutation: `business:create`
- `updateBusiness` mutation: `business:update` + resource ownership
- `deleteBusiness` mutation: `business:delete` + resource ownership
- `addBusinessMember` mutation: `business:manage_members` + resource ownership
- `removeBusinessMember` mutation: `business:manage_members` + resource ownership
- `updateMemberRole` mutation: `business:manage_members` + resource ownership

### Analytics Operations
- `analytics` query: `analytics:read` + business access
- `dashboard` query: `analytics:read` + business access
- `dashboards` query: `analytics:read` + business access
- `reports` query: `analytics:read` + business access
- `report` query: `analytics:read` + resource ownership
- `exportAnalytics` query: `analytics:export` + business access
- `realTimeAnalytics` query: `analytics:real_time` + business access
- `createReport` mutation: `analytics:custom_reports` + business access
- `updateReport` mutation: `analytics:custom_reports` + resource ownership
- `deleteReport` mutation: `analytics:custom_reports` + resource ownership
- `createDashboard` mutation: `analytics:read` + business access
- `updateDashboard` mutation: `analytics:read` + resource ownership
- `deleteDashboard` mutation: `analytics:read` + resource ownership
- `scheduleReport` mutation: `analytics:custom_reports` + resource ownership

## Best Practices

1. **Always include authorization headers** in GraphQL requests
2. **Handle errors gracefully** in your client applications
3. **Use specific scopes** rather than broad permissions
4. **Test with different user roles** to ensure proper access control
5. **Monitor GraphQL errors** to identify authorization issues
6. **Use introspection queries** to discover available operations
7. **Implement proper error handling** for different error types

## Security Considerations

1. **Token Validation**: All GraphQL requests require valid JWT tokens
2. **Scope Verification**: Each operation verifies required scopes
3. **Business Isolation**: Users can only access their business resources
4. **Resource Ownership**: Users can only modify resources they own
5. **Super Admin Access**: Super admins have access to all resources
6. **Error Information**: Error messages don't expose sensitive information
7. **Rate Limiting**: Consider implementing rate limiting for GraphQL operations

This GraphQL scope-based authorization system provides a secure, flexible, and powerful way to manage access control across all GraphQL operations while maintaining the benefits of GraphQL's declarative nature. 