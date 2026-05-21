# AVA GraphQL API Reference

Backend API documentation for the Avakado (AVA) SaaS platform. Share this document with frontend, mobile, and integration teams.

| Property | Value |
|----------|-------|
| **Endpoint** | `POST /graphql` |
| **Introspection** | Enabled |
| **Auth** | JWT via `Authorization: Bearer <token>` or cookies (`accessToken`, `refreshToken`) |
| **Response envelope** | `{ success: boolean, message: string, data: <graphql data> }` |
| **Errors** | Standard GraphQL `errors` array (not wrapped) |

---

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization Directives](#authorization-directives)
3. [Scalars & Shared Types](#scalars--shared-types)
4. [Users Module](#users-module)
5. [Agents Module](#agents-module)
6. [Collections Module](#collections-module)
7. [Channels Module](#channels-module)
8. [Actions Module](#actions-module)
9. [Workflows Module](#workflows-module)
10. [Conversations Module](#conversations-module)
11. [Messages Module](#messages-module)
12. [Jobs & Campaigns Module](#jobs--campaigns-module)
13. [Leads Module](#leads-module)
14. [Integrations Module](#integrations-module)
15. [Twilio Module](#twilio-module)
16. [Service Providers Module](#service-providers-module)
17. [Payments Module](#payments-module)
18. [Tickets Module](#tickets-module)
19. [Notifications Module](#notifications-module)
20. [REST Endpoints (Non-GraphQL)](#rest-endpoints-non-graphql)
21. [Public Operations](#public-operations)

---

## Authentication

### Public operations (no token required)

| Operation | Type | Name variants |
|-----------|------|---------------|
| Login | Mutation | `login`, `Login` |
| Register | Mutation | `register`, `Register` |
| Ephemeral voice token | Query | `ephemeralToken`, `EphemeralToken` |
| Public plans | Query | `fetchPublicPlans` |
| Schema introspection | Query | `IntrospectionQuery` |

### Login

```graphql
mutation Login($input: LoginInput!) {
  login(input: $input) {
    accessToken
    role
    scopes
    user {
      _id
      name
      email
      role
      scopes
      business { _id name logoURL }
    }
  }
}
```

**Variables:**
```json
{ "input": { "email": "admin@company.com", "password": "secret" } }
```

**Errors:** `UNAUTHENTICATED` for invalid email/password or unverified email.

### Register

```graphql
mutation Register($input: BusinessRegistrationInput!) {
  register(input: $input)
}
```

**Variables:**
```json
{
  "input": {
    "name": "Jane Admin",
    "email": "jane@acme.com",
    "password": "SecurePass123!",
    "BusinessName": "Acme Corp",
    "logoURL": "https://cdn.example.com/logo.png"
  }
}
```

---

## Authorization Directives

| Directive | Behavior |
|-----------|----------|
| `@requireScope(scope: String!)` | User must have scope or `super:all` |
| `@requireAnyScope(scopes: [String!]!)` | User must have at least one scope |
| `@requireAllScopes(scopes: [String!]!)` | User must have all scopes |
| `@requireBusinessAccess` | Resource must belong to user's business |
| `@requireResourceOwnership` | User must own resource (optional `creatorIndependent`) |

### Scope reference (used in schema)

| Scope | Used by |
|-------|---------|
| `user:read` | `me` |
| `admin:users` | User CRUD, `users` query |
| `agent:read/create/update/delete/manage_prompts` | Agents |
| `collection:read/create/update/delete` | Collections, file storage |
| `channel:read/create/update/delete` | Channels |
| `action:read/create/update/delete` | Actions |
| `workflow:read/create/update/delete` | Workflows |
| `conversation:read` | Conversations, messages |
| `integration:read/create/update/delete` | Integrations, Twilio queries |
| `ticket:read/update/delete` | Tickets |
| `notification:read/update/delete` | Notifications |
| `subscription:upgrade` | Subscriptions, payments |
| `super:all` | Plan admin (`fetchPlans`, plan CRUD) |

Full scope definitions: `src/models/User.js` → `ScopesEnum`, `RoleScopes`.

---

## Scalars & Shared Types

```graphql
scalar DateTime
scalar JSON
```

### Shared object types

| Type | Fields |
|------|--------|
| `QuickQuestion` | `label`, `value` |
| `Contact` | `mail`, `phone`, `website` |
| `Business` | `_id`, `name`, `logoURL`, `sector`, `tagline`, `facts`, `quickQuestions`, `address`, `description`, `contact`, `createdBy`, `credits`, `createdAt`, `updatedAt` |
| `User` | `_id`, `name`, `email`, `role`, `scopes`, `business`, `isVerified`, `createdAt`, `updatedAt` |
| `PaginationMetaData` | `page`, `limit`, `totalPages`, `totalDocuments` |

---

## Users Module

### Queries

#### `me`
- **Scope:** `user:read`
- **Returns:** `User`

#### `users`
- **Scope:** `admin:users` + `@requireBusinessAccess`
- **Args:** `id`, `limit`, `role` (UserRole), `isVerified`
- **Returns:** `[User]`

### Mutations

| Mutation | Scope | Args | Returns |
|----------|-------|------|---------|
| `createUser` | `admin:users` | `user: UserInput!` | `User` |
| `updateUser` | `admin:users` | `id: ID!`, `user: UserUpdateInput!` | `User` |
| `deleteUser` | `admin:users` | `id: ID!` | `Boolean` |
| `generateUserAccessToken` | — | `expiresIn: String` | `String` |
| `login` | public | `input: LoginInput!` | `LoginResponse` |
| `register` | public | `input: BusinessRegistrationInput!` | `JSON` |
| `talkToAi` | — | `systemInstructions!`, `userQuery!`, `model`, `zodFormat` | `JSON` |

### Inputs & Enums

```graphql
enum UserRole { superAdmin admin manager }
enum UserCreatingRole { admin manager }

input UserInput { name: String!, email: String!, password: String!, role: UserCreatingRole!, scopes: [String] }
input UserUpdateInput { name: String, email: String, role: UserRole, scopes: [String] }
input LoginInput { email: String!, password: String! }
input BusinessRegistrationInput { name: String!, email: String!, password: String!, BusinessName: String!, logoURL: String }
```

---

## Agents Module

### Queries

#### `agents`
- **Scope:** `agent:read`
- **Args:** `limit`, `page`, `isPublic`, `isFeatured`, `id`
- **Returns:** `AgentPagination { data, metaData }`

#### `ephemeralToken` (PUBLIC)
- **Args:** `id`, `model`, `voice`, `provider` (openai | gemini)
- **Returns:** `JSON` (realtime session token)

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `createAgent` | `agent:create` | `agent: AgentInput!` |
| `updateAgent` | `agent:update` | `id: ID!`, `agent: AgentInput!` |
| `deleteAgent` | `agent:delete` | `id: ID!` |
| `generatePrompt` | `agent:manage_prompts` | `prompt: String!` |

### Key types

```graphql
type Agent {
  _id: ID!
  appearance: Appearance
  personalInfo: PersonalInfo
  collections: [Collection]
  workflow: Workflow
  channels: [Channel]
  actions: [Action]
  business: Business
  analysisMetrics: JSON
  createdBy: User
  isPublic: Boolean
  isFeatured: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

input AgentInput {
  appearance: AppearanceInput
  personalInfo: AgentPersonalInfoInput
  collections: [ID]
  workflow: ID
  channels: [ID]
  actions: [ID]
  analysisMetrics: JSON
  isPublic: Boolean
  isFeatured: Boolean
}
```

---

## Collections Module

### Queries

| Query | Scope | Args | Returns |
|-------|-------|------|---------|
| `collections` | `collection:read` | `id`, `limit`, `page`, `isPublic` | `CollectionPagination` |
| `getListOfUploadedFiles` | `collection:read` | `StartAfter`, `ContinuationToken`, `includeSize` | `JSON` |

### Mutations

| Mutation | Scope | Args | Returns |
|----------|-------|------|---------|
| `createCollection` | `collection:create` | `collection: CollectionInput!` | `Collection` |
| `getUploadUrl` | `collection:read` | `key: String!` | `String` (presigned URL) |
| `getDownloadUrl` | `collection:read` | `key: String!` | `String` |
| `deleteUploadedFileFromStorage` | `collection:read` | `key: String!` | `Boolean` |
| `updateCollection` | `collection:update` | `id!`, `name`, `description` | `Collection` |
| `deleteCollection` | `collection:delete` | `id: ID!` | `Boolean` |

### Enums

```graphql
enum contentSourceEnum { website youtube file text }
enum contentStatusEnum { active loading failed }
enum chunkingStrategyEnum { recursiveStructural recursiveSemantic }
enum parserTierEnum { fast cost_effective agentic agentic_plus }
enum parserExpandEnum { text items markdown metadata images_content_metadata xlsx_content_metadata output_pdf_content_metadata }
```

### CollectionInput

```graphql
input CollectionInput {
  name: String!
  description: String
  source: contentSourceEnum!
  chunkingDetails: chunkingDetailsInput
  webcrawler: webcrawlerInput      # website source
  parserDetails: parserDetailsInput  # file source (source_url required)
  isPublic: Boolean
  isFeatured: Boolean
}
```

**File upload flow:**
1. `getUploadUrl(key: "businessId/filename.pdf")` → presigned PUT URL
2. Upload file to Cloudflare R2
3. `createCollection` with `source: file` and `parserDetails.source_url` pointing to R2 URL

**Website flow:**
1. `createCollection` with `source: website` and `webcrawler.urls`
2. Firecrawl processes; webhook updates status

---

## Channels Module

### Queries

#### `getChannels`
- **Scope:** `channel:read`
- **Args:** `_id`, `type`, `status`, `page`, `limit`
- **Returns:** `ChannelPagination`

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `createChannel` | `channel:create` | `input: ChannelInput!` |
| `updateChannel` | `channel:update` | `id: ID!`, `input: ChannelInput!` |
| `deleteChannel` | `channel:delete` | `id: ID!` |

```graphql
enum ChannelTypeEnum { email whatsapp telegram web phone sms instagram twilio }

input ChannelInput {
  name: String
  workflow: ID
  type: ChannelTypeEnum!
  config: JSON
  systemPrompt: String
  isPublic: Boolean
  UIElements: JSON
}
```

---

## Actions Module

### Queries

#### `actions`
- **Scope:** `action:read`
- **Args:** `id`, `limit`, `page`, `isPublic`
- **Returns:** `ActionPagination`

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `createAction` | `action:create` | `action: ActionInput!` |
| `updateAction` | `action:update` | `id: ID!`, `action: ActionInput!` |
| `deleteAction` | `action:delete` | `id: ID!` |

```graphql
input ActionInput {
  name: String!
  description: String
  async: Boolean
  needsApproval: Boolean
  parameters: JSON
  config: JSON
  functionString: String
  errorFunction: String
  UI: JSON
  isPublic: Boolean
}
```

---

## Workflows Module

### Queries

| Query | Scope | Args |
|-------|-------|------|
| `fetchWorkflows` | `workflow:read` | `id`, `limit`, `page` |
| `fetchInbuiltNodes` | `workflow:read` | `label`, `type`, `templateType`, `id`, `limit`, `page` |

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `createWorkflow` | `workflow:create` | `name`, `nodes`, `connections` |
| `updateWorkflow` | `workflow:update` | `id!`, `name`, `nodes`, `connections` |
| `deleteWorkflow` | `workflow:delete` | `id: ID!` |
| `testWorkflowNode` | `workflow:create` | `input`, `node` |
| `createInbuiltNode` | `workflow:create` | `id`, `ports`, `core`, `meta` |
| `updateInbuiltNode` | `workflow:update` | `id`, `ports`, `core`, `meta` |
| `deleteInbuiltNode` | `workflow:delete` | `id: ID!` |

---

## Conversations Module

### Queries only (no mutations)

#### `conversations`
- **Scope:** `conversation:read`
- **Args:**

| Arg | Type |
|-----|------|
| `limit`, `page` | Int |
| `status` | ConversationStatusEnum |
| `id` | ID |
| `campaignIds` | [ID] |
| `channelIds` | [ID] |
| `agentId` | ID |
| `channel` | ChannelStatusEnum |
| `from`, `to` | DateTime |
| `userLocation` | JSON |
| `disconnectReason` | String |

- **Returns:** `ConversationPagination`

```graphql
enum ConversationStatusEnum {
  initiated active interrupted inactive disconnected
  noAnswer busy failed completed inProgress
}
```

---

## Messages Module

### Queries only

#### `fetchMessages`
- **Scope:** `conversation:read`
- **Args:** `conversationId: ID!`, `limit`, `page`
- **Returns:** `[message]`

```graphql
enum reactionEnum { neutral like dislike }

type message {
  _id: ID!
  conversationId: Conversation
  business: Business
  query: String
  response: String
  reaction: reactionEnum
  createdAt: DateTime
  updatedAt: DateTime
}
```

**REST alternative for reactions:** `PUT /reaction` with `{ messageId, reaction }`.

---

## Jobs & Campaigns Module

### Queries

| Query | Args | Returns |
|-------|------|---------|
| `fetchJobs` | `campaignId`, `status`, `priority`, `jobType`, `id`, `schedule_type`, `schedule_run_at`, `limit`, `page` | `[Job]` |
| `fetchCampaigns` | `id`, `limit`, `page` | `CampaignPagination` |

### Mutations

| Mutation | Args |
|----------|------|
| `createCampaign` | `name`, `communicationChannels`, `leads`, `nodes`, `edges` |
| `createJob` | `name`, `description`, `payload`, `schedule`, `tags`, `priority` |
| `updateJobSchedule` | `id`, `schedule` |
| `deleteJob` | `id: ID!` |
| `makeAnOutboundCall` | `number`, `channelId!`, `PreContext`, `campaignId` |
| `exotelCampaignSetup` | `contacts`, `channelId!`, `schedule` |
| `testTataTele` | `channelId!`, `action!`, `data` |

```graphql
enum jobStatusEnum { scheduled active completed failed canceled delayed waiting }
enum jobTypeEnum { outboundCall }
enum scheduleTypeEnum { once cron }
```

---

## Leads Module

### Queries

| Query | Args |
|-------|------|
| `fetchleadsTemplates` | `limit`, `page`, `templateId`, `id`, `isActive` |
| `fetchLeads` | `limit`, `page`, `templateId`, `id`, `status`, `origin`, `creator`, `tags` |
| `fetchLeadFacets` | `templateId`, `status`, `creator`, `origin`, `tags` |

### Mutations

| Mutation | Args |
|----------|------|
| `createLeadTemplate` | `LeadTemplateInput` |
| `updateLeadTemplate` | `id!`, `LeadTemplateInput` |
| `deleteLeadTemplate` | `id` |
| `createLead` | `LeadCreateInput` |
| `bulkCreateLeads` | `dataList: [LeadCreateInput!]!` |
| `updateLead` | `id!`, `LeadCreateInput` |
| `deleteLead` | `id` |

---

## Integrations Module

### Queries

#### `fetchIntegration`
- **Scope:** `integration:read`
- **Args:** `id`
- **Returns:** `[Integration]`

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `createIntegration` | `integration:create` | `name!`, `purpose`, `type!`, `config` |
| `deAuthorizeIntegration` | `integration:delete` | `integrationId: ID!` |

```graphql
enum IntegrationTypeEnum { zoho twilio exotel tataTele whatsapp }
```

---

## Twilio Module

All queries require `integration:read` + `@requireBusinessAccess`.
Mutations for phone numbers require `integration:update`.
Outbound/SMS mutations require `@requireBusinessAccess` only.

### Queries

| Query | Key Args |
|-------|----------|
| `getTwilioAccountDetails` | `integrationId!` |
| `listTwilioAvailableNumbers` | `integrationId!`, `country!`, `type`, `options` |
| `listTwilioOwnedPhoneNumbers` | `integrationId!`, `limit` |
| `getTwilioSmsStatus` | `integrationId!`, `sid!` |
| `getTwilioMessages` | `integrationId!`, filters (to, from, dates, pageSize) |
| `getTwilioCalls` | `integrationId!`, filters (to, from, startTime, endTime, status) |
| `getTwilioCallRecordings` | `integrationId!`, `callSid`, `dateCreated`, `limit` |
| `getTwilioUsageRecords` | `integrationId!`, `category!`, dates |
| `getTwilioUsageRecordsTimely` | `integrationId!`, `Instance!`, `year` |
| `getTwilioPricing` | `integrationId!`, `country!`, `twilioService!` |
| `getTwilioTranscriptions` | `integrationId!`, `callSid` |

### Mutations

| Mutation | Key Args |
|----------|----------|
| `buyTwilioPhoneNumber` | `integrationId!`, `phoneNumber!`, `friendlyName!`, URLs |
| `updateTwilioPhoneNumber` | `integrationId!`, `sid!`, config fields |
| `releaseTwilioPhoneNumber` | `integrationId!`, `sid!` |
| `makeTwilioOutboundTestCall` | `channelId!`, `to!` |
| `makeTwilioAIOutboundCall` | `channelId!`, `to!`, `agentId!`, `PreContext`, `campaignId` |
| `sendTwilioSms` | `integrationId!`, `to!`, `from!`, `body!`, `mediaUrl`, `statusCallback` |

---

## Service Providers Module

No scope directives on schema (authenticated context still required unless public).

### Queries

| Query | Args |
|-------|------|
| `fetchProviders` | `name`, `description`, `icon`, `color`, `_id`, `page`, `limit` |
| `fetchApis` | `providers`, `providerName`, `title`, `description`, `version`, `_id`, `page`, `limit` |
| `fetchApiAuthenticators` | `provider`, `providerName`, `_id`, `page`, `limit` |

### Mutations

`createProvider`, `updateProvider`, `deleteProvider`, `createApi`, `updateApi`, `deleteApi`, `createAuthStrategy`, `createApiAuthenticator`

```graphql
enum apiAuthEnum { oauth2 apiKey basic bearer jwt hmac customHeader mtls cookie none }
```

---

## Payments Module

### Queries

| Query | Scope | Args |
|-------|-------|------|
| `fetchPublicPlans` | **public** | `code`, `name`, `type`, `status`, `id` |
| `fetchPlans` | `super:all` | same |
| `fetchSubscription` | `subscription:upgrade` | `id!` |

### Mutations

| Mutation | Scope |
|----------|-------|
| `createAVAPlan` | `super:all` |
| `updateAVAPlan` | `super:all` |
| `deleteAVAPlan` | `super:all` |
| `startPayment` | `subscription:upgrade` |
| `cancelSubscription` | `subscription:upgrade` |

```graphql
enum PlanTypeEnum { FREE BASE TOPUP }
enum PlanStatusEnum { active inactive }
```

---

## Tickets Module

### Queries

#### `fetchTickets`
- **Scope:** `ticket:read`
- **Args:** `notifierEmail`, `channel`, `priority`, `status`, `id`

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `updateTicket` | `ticket:update` | `id!`, `input: responseInput!` |
| `deleteTicket` | `ticket:delete` | `id: ID!` |

---

## Notifications Module

### Queries

#### `fetchNotifications`
- **Scope:** `notification:read`

### Mutations

| Mutation | Scope | Args |
|----------|-------|------|
| `updateNotifications` | `notification:update` | `statusUpdateInput!` |
| `deleteNotifications` | `notification:delete` | `id: ID!` |

---

## REST Endpoints (Non-GraphQL)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/` | — | Health check |
| PUT | `/reaction` | `{ messageId, reaction }` | reaction: neutral \| like \| dislike |
| POST | `/send-invite` | meetingDetails, attendees, organizerDetails, sender | iCal attachment |
| POST | `/send-mail` | `{ to, subject, text, html?, attachments? }` | |
| POST | `/contact-us` | `{ name, contactDetails, purpose }` | |
| POST | `/raise-ticket` | ticket fields | No GraphQL auth |
| * | `/webhook/firecrawl/*` | crawl payload | |
| * | `/webhook/telegram/*` | Telegram update | |
| * | `/webhook/whatsapp/*` | WhatsApp event | |
| * | `/webhook/instagram/*` | Instagram event | |

---

## Public Operations

```graphql
# No Authorization header required
query PublicPlans { fetchPublicPlans { _id code name type price credits { llm knowledge miscellaneous } } }
mutation Login { login(input: { email: "...", password: "..." }) { accessToken role scopes } }
mutation Register { register(input: { name: "...", email: "...", password: "...", BusinessName: "..." }) }
query VoiceToken { ephemeralToken(id: "AGENT_ID", provider: openai, voice: "alloy") }
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `UNAUTHENTICATED` | Missing/invalid token |
| `FORBIDDEN` | Missing required scope |
| `AUTHENTICATION_FAILED` | Twilio auth failure |
| `INVALID_PHONE_NUMBER` | Twilio 21211 |
| `RATE_LIMITED` | HTTP 429 |
| `BAD_REQUEST` | HTTP 400 |

---

## Module Index (Quick Lookup)

| Module | Queries | Mutations |
|--------|---------|-----------|
| Users | 2 | 7 |
| Agents | 2 | 4 |
| Collections | 2 | 6 |
| Channels | 1 | 3 |
| Actions | 1 | 3 |
| Workflows | 2 | 7 |
| Conversations | 1 | 0 |
| Messages | 1 | 0 |
| Jobs | 2 | 7 |
| Leads | 3 | 6 |
| Integrations | 1 | 2 |
| Twilio | 11 | 6 |
| Service Providers | 3 | 8 |
| Payments | 3 | 5 |
| Tickets | 1 | 2 |
| Notifications | 1 | 2 |

**Total:** ~37 queries, ~68 mutations (including public and unscoped operations).

---

*Generated from Ava_SAAS GraphQL schemas. Zoho module exists in codebase but is not mounted in the active schema.*
