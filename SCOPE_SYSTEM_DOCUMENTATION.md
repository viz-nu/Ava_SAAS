# Scope-Based Authorization System Documentation

## Overview

The Ava SAAS platform implements a comprehensive scope-based authorization system that provides fine-grained access control for different user types and operations. This system replaces the previous role-based authorization with a more flexible and secure approach.

## User Types

### 1. SuperAdmin
- **Role**: `superAdmin`
- **Access Level**: Platform-wide access
- **Description**: Has access to all system features and can manage the entire platform

### 2. Admin
- **Role**: `admin`
- **Access Level**: Business-level access
- **Description**: Can manage their business, agents, collections, and related resources

### 3. Manager
- **Role**: `manager`
- **Access Level**: Limited business access
- **Description**: Can view and interact with business resources but with limited modification capabilities

## Scope Categories

### Authentication & User Management
- `auth:login` - User can login to the system
- `auth:register` - User can register new accounts
- `auth:logout` - User can logout from the system
- `auth:refresh` - User can refresh their access token
- `user:read` - User can read their own profile
- `user:update` - User can update their own profile
- `user:delete` - User can delete their own account

### Business Management
- `business:read` - User can read business information
- `business:create` - User can create new businesses
- `business:update` - User can update business information
- `business:delete` - User can delete businesses
- `business:manage_members` - User can manage business members
- `business:view_analytics` - User can view business analytics
- `business:export_data` - User can export business data

### Agent Management
- `agent:read` - User can read agent information
- `agent:create` - User can create new agents
- `agent:update` - User can update agent configurations
- `agent:delete` - User can delete agents
- `agent:deploy` - User can deploy agents to channels
- `agent:test` - User can test agent responses
- `agent:view_conversations` - User can view agent conversations
- `agent:manage_prompts` - User can manage agent prompts

### Collection Management
- `collection:read` - User can read knowledge collections
- `collection:create` - User can create new collections
- `collection:update` - User can update collection content
- `collection:delete` - User can delete collections
- `collection:upload_files` - User can upload files to collections
- `collection:manage_permissions` - User can manage collection access

### Channel Management
- `channel:read` - User can read channel configurations
- `channel:create` - User can create new channels
- `channel:update` - User can update channel settings
- `channel:delete` - User can delete channels
- `channel:connect` - User can connect external platforms
- `channel:view_webhooks` - User can view webhook configurations

### Action Management
- `action:read` - User can read available actions
- `action:create` - User can create new actions
- `action:update` - User can update action configurations
- `action:delete` - User can delete actions
- `action:test` - User can test action functionality
- `action:manage_integrations` - User can manage external integrations

### Conversation Management
- `conversation:read` - User can read conversations
- `conversation:create` - User can create new conversations
- `conversation:update` - User can update conversation status
- `conversation:delete` - User can delete conversations
- `conversation:export` - User can export conversation data
- `conversation:analyze` - User can analyze conversation patterns

### Ticket Management
- `ticket:read` - User can read support tickets
- `ticket:create` - User can create new tickets
- `ticket:update` - User can update ticket status
- `ticket:delete` - User can delete tickets
- `ticket:assign` - User can assign tickets to team members
- `ticket:escalate` - User can escalate tickets

### Analytics & Reporting
- `analytics:read` - User can view analytics dashboard
- `analytics:export` - User can export analytics data
- `analytics:custom_reports` - User can create custom reports
- `analytics:real_time` - User can view real-time analytics

### File Management
- `file:upload` - User can upload files
- `file:download` - User can download files
- `file:delete` - User can delete files
- `file:share` - User can share files with team members

### Template Management (Marketplace)
- `template:read` - User can read available templates
- `template:create` - User can create new templates
- `template:update` - User can update template content
- `template:delete` - User can delete templates
- `template:publish` - User can publish templates to marketplace
- `template:subscribe` - User can subscribe to templates

### System Administration
- `admin:users` - User can manage all users
- `admin:businesses` - User can manage all businesses
- `admin:system_settings` - User can modify system settings
- `admin:logs` - User can view system logs
- `admin:backup` - User can perform system backups
- `admin:updates` - User can manage system updates

### Super Admin (Platform Level)
- `super:all` - Super admin has access to everything
- `super:platform_management` - User can manage platform-wide settings
- `super:billing` - User can manage billing and subscriptions
- `super:support` - User can manage platform support
- `super:marketplace` - User can manage marketplace content

### Webhook Management
- `webhook:read` - User can read webhook configurations
- `webhook:create` - User can create new webhooks
- `webhook:update` - User can update webhook settings
- `webhook:delete` - User can delete webhooks
- `webhook:test` - User can test webhook endpoints

### Subscription Management
- `subscription:read` - User can read subscription details
- `subscription:upgrade` - User can upgrade subscription
- `subscription:downgrade` - User can downgrade subscription
- `subscription:cancel` - User can cancel subscription
- `subscription:billing` - User can manage billing information

## Default Scope Assignments

### SuperAdmin Default Scopes
SuperAdmins automatically receive all scopes in the system, including:
- All super admin scopes (`super:*`)
- All admin scopes (`admin:*`)
- All business management scopes
- All agent management scopes
- All collection management scopes
- All channel management scopes
- All action management scopes
- All conversation management scopes
- All ticket management scopes
- All analytics scopes
- All file management scopes
- All template management scopes
- All webhook management scopes
- All subscription management scopes
- All authentication scopes

### Admin Default Scopes
Admins receive business-level scopes:
- Business management (read, update, manage_members, view_analytics, export_data)
- Agent management (all scopes)
- Collection management (all scopes)
- Channel management (all scopes)
- Action management (all scopes)
- Conversation management (all scopes)
- Ticket management (all scopes)
- Analytics (all scopes)
- File management (all scopes)
- Template management (read, subscribe)
- Webhook management (all scopes)
- Subscription management (all scopes)
- Authentication (login, logout, refresh)
- User management (read, update)

### Manager Default Scopes
Managers receive limited read and interaction scopes:
- Business management (read, view_analytics)
- Agent management (read, test, view_conversations)
- Collection management (read, upload_files)
- Channel management (read)
- Action management (read, test)
- Conversation management (read, export, analyze)
- Ticket management (read, create, update)
- Analytics (read, export)
- File management (upload, download, share)
- Template management (read, subscribe)
- Webhook management (read)
- Subscription management (read)
- Authentication (login, logout, refresh)
- User management (read, update)

## Middleware Functions

### Authentication Middleware
- `authMiddleware` - Verifies JWT tokens and loads user data
- `conditionalAuth` - Conditionally applies authentication

### Role-Based Authorization
- `isAdmin` - Checks if user has admin role
- `isSuperAdmin` - Checks if user has superAdmin role
- `isManager` - Checks if user has manager role

### Scope-Based Authorization
- `requireScope(scope)` - Requires a specific scope
- `requireAnyScope(scopes)` - Requires any of the provided scopes
- `requireAllScopes(scopes)` - Requires all of the provided scopes

### Business-Specific Authorization
- `requireBusinessAccess(businessIdField)` - Checks business access
- `requireBusinessScope(scope, businessIdField)` - Combines scope and business access checks

### Resource Ownership
- `requireResourceOwnership(model, resourceIdField, ownerField)` - Checks resource ownership

### Rate Limiting
- `scopeRateLimit(scope, maxRequests, windowMs)` - Rate limits based on scope

## API Routes with Scope Protection

### Authentication Routes (`/api/v1/auth`)
- `POST /register` - No auth required
- `POST /login` - No auth required
- `POST /super-admin-login` - No auth required

### Public Routes (`/api/v1/public`)
- `GET /business-suggest` - No auth required
- `GET /business-details/:name` - No auth required

### Admin Routes (`/api/v1/admin`)
- `GET /dashboard` - Requires `analytics:read`
- `GET /new-dashboard` - Requires `analytics:read`
- `POST /query-analysis` - Requires `analytics:read` or `analytics:custom_reports`
- `PUT /edit-business` - Requires `business:update`
- `POST /raise-ticket` - Requires `ticket:create`

### Scope Management Routes (`/api/v1/admin`)
- `GET /scopes` - Requires `admin:users`
- `GET /scopes/categories` - Requires `admin:users`
- `GET /scopes/role/:role` - Requires `admin:users`
- `POST /scopes/validate` - Requires `admin:users`
- `GET /scopes/hierarchy` - Requires `admin:users`
- `GET /users/:userId/scopes/audit` - Requires `admin:users`
- `PUT /users/:userId/scopes` - Requires `admin:users`
- `POST /users/scopes/bulk-update` - Requires `admin:users`

### Agent Routes (`/api/v1/agent`)
- `POST /promptGeneration` - Requires `agent:manage_prompts`
- `POST /` - Requires `agent:create`
- `GET /:id` - Requires `agent:read`
- `PUT /:id` - Requires `agent:update` + resource ownership
- `DELETE /:id` - Requires `agent:delete` + resource ownership

### Collection Routes (`/api/v1/collection`)
- `POST /` - Requires `collection:create`
- `GET /:id` - Requires `collection:read`
- `PUT /:id` - Requires `collection:update` + resource ownership
- `DELETE /:id` - Requires `collection:delete` + resource ownership

### Essentials Routes (`/api/v1/essentials`)
- `GET /business-suggest` - No auth required
- `GET /sub-urls` - Requires `business:read`
- `POST /upload` - Requires `file:upload`

### Channel Routes (`/api/v1/channels`)
- `POST /` - Requires `channel:create`
- `GET /:id` - Requires `channel:read`
- `PUT /:id` - Requires `channel:update` + resource ownership
- `DELETE /:id` - Requires `channel:delete` + resource ownership

### Action Routes (`/api/v1/actions`)
- `POST /` - Requires `action:create`
- `GET /:id` - Requires `action:read`
- `PUT /:id` - Requires `action:update` + resource ownership
- `DELETE /:id` - Requires `action:delete` + resource ownership

### Template Routes (`/api/v1/template`)
- `POST /` - Requires `template:create`
- `GET /:id` - Requires `template:read`
- `PUT /:id` - Requires `template:update` + resource ownership
- `PATCH /:id` - Requires `template:update` + resource ownership
- `DELETE /:id` - Requires `template:delete` + resource ownership

### Ticket Routes (`/api/v1/tickets`)
- `GET /:id` - Requires `ticket:read`
- `PATCH /:id` - Requires `ticket:update` + resource ownership

### Super User Routes (`/api/v1/super`)
- `GET /platform-stats` - Requires `super:platform_management`
- `GET /system-logs` - Requires `admin:logs`
- `POST /system-backup` - Requires `admin:backup`
- `GET /billing-overview` - Requires `super:billing`
- `GET /marketplace-management` - Requires `super:marketplace`
- `GET /support-tickets` - Requires `super:support`

## Usage Examples

### Checking Scopes in Controllers
```javascript
// Check if user has a specific scope
if (!req.user.hasScope('agent:create')) {
    return res.status(403).json({ message: 'Insufficient permissions' });
}

// Check if user has any of multiple scopes
if (!req.user.hasAnyScope(['analytics:read', 'analytics:custom_reports'])) {
    return res.status(403).json({ message: 'Insufficient permissions' });
}

// Check if user has all required scopes
if (!req.user.hasAllScopes(['business:read', 'business:update'])) {
    return res.status(403).json({ message: 'Insufficient permissions' });
}
```

### Adding/Removing Scopes
```javascript
// Add scopes to user
await user.addScopes(['agent:create', 'agent:update']);

// Remove scopes from user
await user.removeScopes(['agent:delete']);

// Replace all scopes
user.scopes = ['agent:read', 'agent:test'];
await user.save();
```

### Using Scope Management API
```javascript
// Get all available scopes
GET /api/v1/admin/scopes

// Get scopes by category
GET /api/v1/admin/scopes/categories

// Get default scopes for a role
GET /api/v1/admin/scopes/role/admin

// Validate scopes
POST /api/v1/admin/scopes/validate
{
    "scopes": ["agent:create", "agent:update"]
}

// Update user scopes
PUT /api/v1/admin/users/:userId/scopes
{
    "scopes": ["agent:create", "agent:update"],
    "operation": "add"
}

// Bulk update user scopes
POST /api/v1/admin/users/scopes/bulk-update
{
    "updates": [
        {
            "userId": "user1",
            "scopes": ["agent:create"],
            "operation": "add"
        },
        {
            "userId": "user2",
            "scopes": ["agent:delete"],
            "operation": "remove"
        }
    ]
}
```

## Security Considerations

1. **Principle of Least Privilege**: Users are assigned only the scopes they need
2. **Scope Validation**: All scopes are validated against the predefined list
3. **Resource Ownership**: Users can only access resources they own or belong to their business
4. **Business Isolation**: Users cannot access resources from other businesses
5. **Rate Limiting**: Scope-based rate limiting prevents abuse
6. **Audit Trail**: Scope changes are logged for security auditing

## Migration Guide

### From Role-Based to Scope-Based
1. Existing users will automatically receive default scopes based on their role
2. Update route middleware to use scope-based authorization
3. Test all endpoints to ensure proper access control
4. Monitor and adjust scope assignments as needed

### Adding New Scopes
1. Add the scope to `ScopesEnum` in `src/models/User.js`
2. Update `RoleScopes` to include the new scope for appropriate roles
3. Update route middleware to use the new scope
4. Test the new scope functionality

## Best Practices

1. **Use Specific Scopes**: Instead of broad permissions, use specific scopes
2. **Regular Audits**: Regularly audit user scopes to ensure they have appropriate access
3. **Scope Hierarchy**: Understand the scope hierarchy and use appropriate scopes
4. **Documentation**: Document any custom scope requirements
5. **Testing**: Test scope-based authorization thoroughly
6. **Monitoring**: Monitor scope usage and access patterns

## Troubleshooting

### Common Issues
1. **403 Forbidden**: User lacks required scope
2. **401 Unauthorized**: User not authenticated
3. **400 Bad Request**: Invalid scope provided
4. **404 Not Found**: Resource not found or user lacks access

### Debugging
1. Check user scopes: `GET /api/v1/admin/users/:userId/scopes/audit`
2. Validate scopes: `POST /api/v1/admin/scopes/validate`
3. Check scope hierarchy: `GET /api/v1/admin/scopes/hierarchy`
4. Review route middleware configuration 