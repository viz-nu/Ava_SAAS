import { errorWrapper } from "../../middleware/errorWrapper.js";
import { User } from "../../models/User.js";
import {
    getAllScopes,
    getScopesByCategory,
    getDefaultScopesForRole,
    validateScopes,
    generateScopeAuditReport,
    getScopeHierarchy
} from "../../utils/scopeManager.js";

// Get all available scopes
export const getAllAvailableScopes = errorWrapper(async (req, res) => {
    const scopes = getAllScopes();
    const scopesWithDescriptions = scopes.map(scope => ({
        scope,
        description: getScopeDescription(scope)
    }));

    return {
        statusCode: 200,
        message: 'All available scopes retrieved successfully',
        data: scopesWithDescriptions
    };
});

// Get scopes by category
export const getScopesByCategoryController = errorWrapper(async (req, res) => {
    const categorizedScopes = getScopesByCategory();

    return {
        statusCode: 200,
        message: 'Scopes categorized successfully',
        data: categorizedScopes
    };
});

// Get default scopes for a role
export const getDefaultScopesForRoleController = errorWrapper(async (req, res) => {
    const { role } = req.params;

    if (!role) {
        return {
            statusCode: 400,
            message: 'Role parameter is required',
            data: null
        };
    }

    const defaultScopes = getDefaultScopesForRole(role);
    const scopesWithDescriptions = defaultScopes.map(scope => ({
        scope,
        description: getScopeDescription(scope)
    }));

    return {
        statusCode: 200,
        message: `Default scopes for role '${role}' retrieved successfully`,
        data: {
            role,
            scopes: scopesWithDescriptions,
            count: defaultScopes.length
        }
    };
});

// Validate scopes
export const validateScopesController = errorWrapper(async (req, res) => {
    const { scopes } = req.body;

    if (!Array.isArray(scopes)) {
        return {
            statusCode: 400,
            message: 'Scopes must be an array',
            data: null
        };
    }

    const validation = validateScopes(scopes);

    return {
        statusCode: 200,
        message: validation.isValid ? 'All scopes are valid' : 'Some scopes are invalid',
        data: validation
    };
});

// Get user scope audit report
export const getUserScopeAudit = errorWrapper(async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return {
            statusCode: 400,
            message: 'User ID is required',
            data: null
        };
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
        return {
            statusCode: 404,
            message: 'User not found',
            data: null
        };
    }

    const auditReport = generateScopeAuditReport(user);

    return {
        statusCode: 200,
        message: 'User scope audit report generated successfully',
        data: auditReport
    };
});

// Update user scopes
export const updateUserScopes = errorWrapper(async (req, res) => {
    const { userId } = req.params;
    const { scopes, operation } = req.body; // operation: 'add', 'remove', 'replace'

    if (!userId) {
        return {
            statusCode: 400,
            message: 'User ID is required',
            data: null
        };
    }

    if (!Array.isArray(scopes)) {
        return {
            statusCode: 400,
            message: 'Scopes must be an array',
            data: null
        };
    }

    // Validate scopes
    const validation = validateScopes(scopes);
    if (!validation.isValid) {
        return {
            statusCode: 400,
            message: 'Invalid scopes provided',
            data: validation
        };
    }

    const user = await User.findById(userId);

    if (!user) {
        return {
            statusCode: 404,
            message: 'User not found',
            data: null
        };
    }

    // Update scopes based on operation
    switch (operation) {
        case 'add':
            await user.addScopes(validation.validScopes);
            break;
        case 'remove':
            await user.removeScopes(validation.validScopes);
            break;
        case 'replace':
            user.scopes = validation.validScopes;
            await user.save();
            break;
        default:
            return {
                statusCode: 400,
                message: 'Invalid operation. Must be "add", "remove", or "replace"',
                data: null
            };
    }

    return {
        statusCode: 200,
        message: `User scopes ${operation}ed successfully`,
        data: {
            userId: user._id,
            updatedScopes: user.scopes,
            operation
        }
    };
});

// Get scope hierarchy
export const getScopeHierarchyController = errorWrapper(async (req, res) => {
    const hierarchy = getScopeHierarchy();

    return {
        statusCode: 200,
        message: 'Scope hierarchy retrieved successfully',
        data: hierarchy
    };
});

// Bulk update user scopes
export const bulkUpdateUserScopes = errorWrapper(async (req, res) => {
    const { updates } = req.body; // Array of { userId, scopes, operation }

    if (!Array.isArray(updates)) {
        return {
            statusCode: 400,
            message: 'Updates must be an array',
            data: null
        };
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
        try {
            const { userId, scopes, operation } = update;

            if (!userId || !Array.isArray(scopes) || !operation) {
                errors.push({
                    userId,
                    error: 'Missing required fields: userId, scopes (array), operation'
                });
                continue;
            }

            // Validate scopes
            const validation = validateScopes(scopes);
            if (!validation.isValid) {
                errors.push({
                    userId,
                    error: 'Invalid scopes',
                    invalidScopes: validation.invalidScopes
                });
                continue;
            }

            const user = await User.findById(userId);

            if (!user) {
                errors.push({
                    userId,
                    error: 'User not found'
                });
                continue;
            }

            // Update scopes based on operation
            switch (operation) {
                case 'add':
                    await user.addScopes(validation.validScopes);
                    break;
                case 'remove':
                    await user.removeScopes(validation.validScopes);
                    break;
                case 'replace':
                    user.scopes = validation.validScopes;
                    await user.save();
                    break;
                default:
                    errors.push({
                        userId,
                        error: 'Invalid operation. Must be "add", "remove", or "replace"'
                    });
                    continue;
            }

            results.push({
                userId: user._id,
                updatedScopes: user.scopes,
                operation
            });

        } catch (error) {
            errors.push({
                userId: update.userId,
                error: error.message
            });
        }
    }

    return {
        statusCode: 200,
        message: 'Bulk scope update completed',
        data: {
            successful: results,
            errors,
            summary: {
                total: updates.length,
                successful: results.length,
                failed: errors.length
            }
        }
    };
}); 