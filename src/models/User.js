import { model, Schema } from 'mongoose';

// Comprehensive scope definitions for all user types
const ScopesEnum = {
    // Authentication & User Management
    'auth:login': 'User can login to the system',
    'auth:register': 'User can register new accounts',
    'auth:logout': 'User can logout from the system',
    'auth:refresh': 'User can refresh their access token',
    'user:read': 'User can read their own profile',
    'user:update': 'User can update their own profile',
    'user:delete': 'User can delete their own account',

    // Business Management
    'business:read': 'User can read business information',
    'business:create': 'User can create new businesses',
    'business:update': 'User can update business information',
    'business:delete': 'User can delete businesses',
    'business:manage_members': 'User can manage business members',
    'business:view_analytics': 'User can view business analytics',
    'business:export_data': 'User can export business data',

    // Agent Management
    'agent:read': 'User can read agent information',
    'agent:create': 'User can create new agents',
    'agent:update': 'User can update agent configurations',
    'agent:delete': 'User can delete agents',
    'agent:deploy': 'User can deploy agents to channels',
    'agent:test': 'User can test agent responses',
    'agent:view_conversations': 'User can view agent conversations',
    'agent:manage_prompts': 'User can manage agent prompts',

    // Collection Management
    'collection:read': 'User can read knowledge collections',
    'collection:create': 'User can create new collections',
    'collection:update': 'User can update collection content',
    'collection:delete': 'User can delete collections',
    'collection:upload_files': 'User can upload files to collections',
    'collection:manage_permissions': 'User can manage collection access',

    // Channel Management
    'channel:read': 'User can read channel configurations',
    'channel:create': 'User can create new channels',
    'channel:update': 'User can update channel settings',
    'channel:delete': 'User can delete channels',
    'channel:connect': 'User can connect external platforms',
    'channel:view_webhooks': 'User can view webhook configurations',

    // Action Management
    'action:read': 'User can read available actions',
    'action:create': 'User can create new actions',
    'action:update': 'User can update action configurations',
    'action:delete': 'User can delete actions',
    'action:test': 'User can test action functionality',
    'action:manage_integrations': 'User can manage external integrations',

    // Conversation Management
    'conversation:read': 'User can read conversations',
    'conversation:create': 'User can create new conversations',
    'conversation:update': 'User can update conversation status',
    'conversation:delete': 'User can delete conversations',
    'conversation:export': 'User can export conversation data',
    'conversation:analyze': 'User can analyze conversation patterns',

    // Ticket Management
    'ticket:read': 'User can read support tickets',
    'ticket:create': 'User can create new tickets',
    'ticket:update': 'User can update ticket status',
    'ticket:delete': 'User can delete tickets',
    'ticket:assign': 'User can assign tickets to team members',
    'ticket:escalate': 'User can escalate tickets',

    // Analytics & Reporting
    'analytics:read': 'User can view analytics dashboard',
    'analytics:export': 'User can export analytics data',
    'analytics:custom_reports': 'User can create custom reports',
    'analytics:real_time': 'User can view real-time analytics',

    // File Management
    'file:upload': 'User can upload files',
    'file:download': 'User can download files',
    'file:delete': 'User can delete files',
    'file:share': 'User can share files with team members',

    // Template Management (Marketplace)
    'template:read': 'User can read available templates',
    'template:create': 'User can create new templates',
    'template:update': 'User can update template content',
    'template:delete': 'User can delete templates',
    'template:publish': 'User can publish templates to marketplace',
    'template:subscribe': 'User can subscribe to templates',

    // System Administration
    'admin:users': 'User can manage all users',
    'admin:businesses': 'User can manage all businesses',
    'admin:system_settings': 'User can modify system settings',
    'admin:logs': 'User can view system logs',
    'admin:backup': 'User can perform system backups',
    'admin:updates': 'User can manage system updates',

    // Super Admin (Platform Level)
    'super:all': 'Super admin has access to everything',
    'super:platform_management': 'User can manage platform-wide settings',
    'super:billing': 'User can manage billing and subscriptions',
    'super:support': 'User can manage platform support',
    'super:marketplace': 'User can manage marketplace content',

    // Webhook Management
    'webhook:read': 'User can read webhook configurations',
    'webhook:create': 'User can create new webhooks',
    'webhook:update': 'User can update webhook settings',
    'webhook:delete': 'User can delete webhooks',
    'webhook:test': 'User can test webhook endpoints',

    // Subscription Management
    'subscription:read': 'User can read subscription details',
    'subscription:upgrade': 'User can upgrade subscription',
    'subscription:downgrade': 'User can downgrade subscription',
    'subscription:cancel': 'User can cancel subscription',
    'subscription:billing': 'User can manage billing information',

    // Notification Management
    'notification:read': 'User can read notifications',
    'notification:update': 'User can update notification status',
    'notification:delete': 'User can delete notifications',

    // Integration Management
    'integration:read': 'User can read integration details',
    'integration:create': 'User can create new integrations',
    'integration:update': 'User can update integration configurations',
    'integration:delete': 'User can delete integrations',

};

// Role-based scope mappings
const RoleScopes = {
    'superAdmin': [
        'super:all',
        'super:platform_management',
        'super:billing',
        'super:support',
        'super:marketplace',
        'admin:users',
        'admin:businesses',
        'admin:system_settings',
        'admin:logs',
        'admin:backup',
        'admin:updates',
        'business:read',
        'business:create',
        'business:update',
        'business:delete',
        'business:manage_members',
        'business:view_analytics',
        'business:export_data',
        'agent:read',
        'agent:create',
        'agent:update',
        'agent:delete',
        'agent:deploy',
        'agent:test',
        'agent:view_conversations',
        'agent:manage_prompts',
        'collection:read',
        'collection:create',
        'collection:update',
        'collection:delete',
        'collection:upload_files',
        'collection:manage_permissions',
        'channel:read',
        'channel:create',
        'channel:update',
        'channel:delete',
        'channel:connect',
        'channel:view_webhooks',
        'action:read',
        'action:create',
        'action:update',
        'action:delete',
        'action:test',
        'action:manage_integrations',
        'conversation:read',
        'conversation:create',
        'conversation:update',
        'conversation:delete',
        'conversation:export',
        'conversation:analyze',
        'ticket:read',
        'ticket:create',
        'ticket:update',
        'ticket:delete',
        'ticket:assign',
        'ticket:escalate',
        'analytics:read',
        'analytics:export',
        'analytics:custom_reports',
        'analytics:real_time',
        'file:upload',
        'file:download',
        'file:delete',
        'file:share',
        'template:read',
        'template:create',
        'template:update',
        'template:delete',
        'template:publish',
        'template:subscribe',
        'webhook:read',
        'webhook:create',
        'webhook:update',
        'webhook:delete',
        'webhook:test',
        'subscription:read',
        'subscription:upgrade',
        'subscription:downgrade',
        'subscription:cancel',
        'subscription:billing',
        'auth:login',
        'auth:register',
        'auth:logout',
        'auth:refresh',
        'user:read',
        'user:update',
        'user:delete',
        'notification:read',
        'notification:update',
        'notification:delete',
        'integration:read',
        'integration:create',
        'integration:update',
        'integration:delete'
    ],
    'admin': [
        'admin:users',
        'business:read',
        'business:update',
        'business:manage_members',
        'business:view_analytics',
        'business:export_data',
        'agent:read',
        'agent:create',
        'agent:update',
        'agent:delete',
        'agent:deploy',
        'agent:test',
        'agent:view_conversations',
        'agent:manage_prompts',
        'collection:read',
        'collection:create',
        'collection:update',
        'collection:delete',
        'collection:upload_files',
        'collection:manage_permissions',
        'channel:read',
        'channel:create',
        'channel:update',
        'channel:delete',
        'channel:connect',
        'channel:view_webhooks',
        'action:read',
        'action:create',
        'action:update',
        'action:delete',
        'action:test',
        'action:manage_integrations',
        'conversation:read',
        'conversation:create',
        'conversation:update',
        'conversation:delete',
        'conversation:export',
        'conversation:analyze',
        'ticket:read',
        'ticket:create',
        'ticket:update',
        'ticket:delete',
        'ticket:assign',
        'ticket:escalate',
        'analytics:read',
        'analytics:export',
        'analytics:custom_reports',
        'analytics:real_time',
        'file:upload',
        'file:download',
        'file:delete',
        'file:share',
        'template:read',
        'template:subscribe',
        'webhook:read',
        'webhook:create',
        'webhook:update',
        'webhook:delete',
        'webhook:test',
        'subscription:read',
        'subscription:upgrade',
        'subscription:downgrade',
        'subscription:cancel',
        'subscription:billing',
        'auth:login',
        'auth:logout',
        'auth:refresh',
        'user:read',
        'user:update',
        'notification:read',
        'notification:update',
        'notification:delete',
        'integration:read',
        'integration:create',
        'integration:update',
        'integration:delete'
    ],
    'manager': [
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
        'user:update',
        'notification:read'
    ]
};

const UserSchema = new Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['admin', 'manager', 'superAdmin'], default: 'admin' },
    scopes: [{ type: String, enum: Object.keys(ScopesEnum) }],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    isVerified: { type: Boolean, default: false },
    emailToken: String,
}, {
    timestamps: true
});

// Pre-save middleware to assign default scopes based on role
UserSchema.pre('save', function (next) {
    if (this.isNew || this.isModified('role')) {
        this.scopes = RoleScopes[this.role] || [];
    }
    next();
});

// Method to check if user has a specific scope
UserSchema.methods.hasScope = function (scope) {
    return this.scopes.includes(scope) || this.scopes.includes('super:all');
};

// Method to check if user has any of the provided scopes
UserSchema.methods.hasAnyScope = function (scopes) {
    if (this.scopes.includes('super:all')) return true;
    return scopes.some(scope => this.scopes.includes(scope));
};

// Method to check if user has all of the provided scopes
UserSchema.methods.hasAllScopes = function (scopes) {
    if (this.scopes.includes('super:all')) return true;
    return scopes.every(scope => this.scopes.includes(scope));
};

// Method to add scopes to user
UserSchema.methods.addScopes = function (scopes) {
    const newScopes = scopes.filter(scope => !this.scopes.includes(scope));
    this.scopes.push(...newScopes);
    return this.save();
};

// Method to remove scopes from user
UserSchema.methods.removeScopes = function (scopes) {
    this.scopes = this.scopes.filter(scope => !scopes.includes(scope));
    return this.save();
};
const User = model('Users', UserSchema, "Users");
export { User, ScopesEnum, RoleScopes };
