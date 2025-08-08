import { errorWrapper } from "../../middleware/errorWrapper.js";
import { User } from "../../models/User.js";
import { Business } from "../../models/Business.js";
import bcrypt from 'bcryptjs';
import {
    getDefaultScopesForRole,
    validateScopes,
    generateScopeAuditReport
} from "../../utils/scopeManager.js";
import { sendMail } from "../../utils/sendEmail.js";

// Get all managers for the business
export const getAllManagers = errorWrapper(async (req, res) => {
    const { limit = 10, businessId, isVerified, search } = req.query;

    const filter = { role: 'manager' };

    // Filter by business
    if (businessId) {
        filter.business = businessId;
    } else if (req.user.business) {
        filter.business = req.user.business;
    }

    if (isVerified !== undefined) filter.isVerified = isVerified;

    // Search functionality
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }

    const managers = await User.find(filter)
        .populate('business')
        .select('-password')
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

    const total = await User.countDocuments(filter);

    return {
        statusCode: 200,
        message: 'Managers retrieved successfully',
        data: managers,
        metaData: {
            total,
            limit: parseInt(limit),
            page: 1
        }
    };
});

// Get specific manager by ID
export const getManagerById = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' })
        .populate('business')
        .select('-password');

    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    return {
        statusCode: 200,
        message: 'Manager retrieved successfully',
        data: manager
    };
});

// Create a new manager
export const createManager = errorWrapper(async (req, res) => {
    const { name, email, password, businessId, scopes, sendInvite = true } = req.body;

    // Validate required fields
    if (!name || !email) {
        return {
            statusCode: 400,
            message: 'Name and email are required',
            data: null
        };
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return {
            statusCode: 400,
            message: 'User with this email already exists',
            data: null
        };
    }

    // Set business
    const business = businessId || req.user.business;
    if (!business) {
        return {
            statusCode: 400,
            message: 'Business ID is required',
            data: null
        };
    }

    // Validate business exists
    const businessExists = await Business.findById(business);
    if (!businessExists) {
        return {
            statusCode: 400,
            message: 'Business not found',
            data: null
        };
    }

    // Hash password if provided
    let hashedPassword = null;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 12);
    }

    // Validate scopes if provided
    let managerScopes = getDefaultScopesForRole('manager');
    if (scopes && Array.isArray(scopes)) {
        const validation = validateScopes(scopes);
        if (!validation.isValid) {
            return {
                statusCode: 400,
                message: `Invalid scopes: ${validation.invalidScopes.join(', ')}`,
                data: null
            };
        }
        managerScopes = validation.validScopes;
    }

    // Create manager
    const manager = new User({
        name,
        email,
        password: hashedPassword,
        role: 'manager',
        business,
        scopes: managerScopes,
        isVerified: !sendInvite // If sending invite, mark as unverified
    });

    const savedManager = await manager.save();

    // Send invitation email if requested
    if (sendInvite && !password) {
        try {
            await sendManagerInvitationEmail(savedManager, businessExists);
        } catch (error) {
            console.error('Failed to send invitation email:', error);
        }
    }

    const managerData = await User.findById(savedManager._id)
        .populate('business')
        .select('-password');

    return {
        statusCode: 201,
        message: 'Manager created successfully',
        data: managerData
    };
});

// Update manager
export const updateManager = errorWrapper(async (req, res) => {
    const { id } = req.params;
    const { name, email, businessId, scopes, isVerified } = req.body;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    // Check if email is being changed and if it already exists
    if (email && email !== manager.email) {
        const existingUser = await User.findOne({ email, _id: { $ne: id } });
        if (existingUser) {
            return {
                statusCode: 400,
                message: 'User with this email already exists',
                data: null
            };
        }
    }

    // Validate business if being changed
    if (businessId) {
        const businessExists = await Business.findById(businessId);
        if (!businessExists) {
            return {
                statusCode: 400,
                message: 'Business not found',
                data: null
            };
        }
    }

    // Validate scopes if provided
    if (scopes && Array.isArray(scopes)) {
        const validation = validateScopes(scopes);
        if (!validation.isValid) {
            return {
                statusCode: 400,
                message: `Invalid scopes: ${validation.invalidScopes.join(', ')}`,
                data: null
            };
        }
    }

    // Update manager
    const updateData = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (businessId) updateData.business = businessId;
    if (scopes) updateData.scopes = scopes;
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    const updatedManager = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
    )
        .populate('business')
        .select('-password');

    return {
        statusCode: 200,
        message: 'Manager updated successfully',
        data: updatedManager
    };
});

// Delete manager
export const deleteManager = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    await User.findByIdAndDelete(id);

    return {
        statusCode: 200,
        message: 'Manager deleted successfully',
        data: null
    };
});

// Assign manager to business
export const assignManagerToBusiness = errorWrapper(async (req, res) => {
    const { id } = req.params;
    const { businessId } = req.body;

    if (!businessId) {
        return {
            statusCode: 400,
            message: 'Business ID is required',
            data: null
        };
    }

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    const business = await Business.findById(businessId);
    if (!business) {
        return {
            statusCode: 400,
            message: 'Business not found',
            data: null
        };
    }

    manager.business = businessId;
    manager.updatedAt = new Date();
    await manager.save();

    const updatedManager = await User.findById(id)
        .populate('business')
        .select('-password');

    return {
        statusCode: 200,
        message: 'Manager assigned to business successfully',
        data: updatedManager
    };
});

// Update manager scopes
export const updateManagerScopes = errorWrapper(async (req, res) => {
    const { id } = req.params;
    const { scopes, operation } = req.body;

    if (!scopes || !Array.isArray(scopes) || !operation) {
        return {
            statusCode: 400,
            message: 'Scopes array and operation are required',
            data: null
        };
    }

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    // Validate scopes
    const validation = validateScopes(scopes);
    if (!validation.isValid) {
        return {
            statusCode: 400,
            message: `Invalid scopes: ${validation.invalidScopes.join(', ')}`,
            data: null
        };
    }

    // Update scopes based on operation
    switch (operation) {
        case 'add':
            await manager.addScopes(validation.validScopes);
            break;
        case 'remove':
            await manager.removeScopes(validation.validScopes);
            break;
        case 'replace':
            manager.scopes = validation.validScopes;
            await manager.save();
            break;
        default:
            return {
                statusCode: 400,
                message: 'Invalid operation. Must be "add", "remove", or "replace"',
                data: null
            };
    }

    const updatedManager = await User.findById(id)
        .populate('business')
        .select('-password');

    return {
        statusCode: 200,
        message: 'Manager scopes updated successfully',
        data: updatedManager
    };
});

// Bulk update managers
export const bulkUpdateManagers = errorWrapper(async (req, res) => {
    const { updates } = req.body;

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
            const { managerId, scopes, operation } = update;

            if (!managerId || !Array.isArray(scopes) || !operation) {
                errors.push({
                    managerId,
                    error: 'Missing required fields: managerId, scopes (array), operation'
                });
                continue;
            }

            // Validate scopes
            const validation = validateScopes(scopes);
            if (!validation.isValid) {
                errors.push({
                    managerId,
                    error: 'Invalid scopes',
                    invalidScopes: validation.invalidScopes
                });
                continue;
            }

            const manager = await User.findOne({ _id: managerId, role: 'manager' });
            if (!manager) {
                errors.push({
                    managerId,
                    error: 'Manager not found'
                });
                continue;
            }

            // Update scopes based on operation
            switch (operation) {
                case 'add':
                    await manager.addScopes(validation.validScopes);
                    break;
                case 'remove':
                    await manager.removeScopes(validation.validScopes);
                    break;
                case 'replace':
                    manager.scopes = validation.validScopes;
                    await manager.save();
                    break;
                default:
                    errors.push({
                        managerId,
                        error: 'Invalid operation. Must be "add", "remove", or "replace"'
                    });
                    continue;
            }

            results.push({
                managerId: manager._id,
                updatedScopes: manager.scopes,
                operation
            });

        } catch (error) {
            errors.push({
                managerId: update.managerId,
                error: error.message
            });
        }
    }

    return {
        statusCode: 200,
        message: 'Bulk manager update completed',
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

// Deactivate manager
export const deactivateManager = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    manager.isVerified = false;
    manager.updatedAt = new Date();
    await manager.save();

    const updatedManager = await User.findById(id)
        .populate('business')
        .select('-password');

    return {
        statusCode: 200,
        message: 'Manager deactivated successfully',
        data: updatedManager
    };
});

// Reactivate manager
export const reactivateManager = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    manager.isVerified = true;
    manager.updatedAt = new Date();
    await manager.save();

    const updatedManager = await User.findById(id)
        .populate('business')
        .select('-password');

    return {
        statusCode: 200,
        message: 'Manager reactivated successfully',
        data: updatedManager
    };
});

// Reset manager password
export const resetManagerPassword = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    // Generate a random password
    const newPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    manager.password = hashedPassword;
    manager.updatedAt = new Date();
    await manager.save();

    // Send password reset email
    try {
        await sendPasswordResetEmail(manager, newPassword);
    } catch (error) {
        console.error('Failed to send password reset email:', error);
    }

    return {
        statusCode: 200,
        message: 'Manager password reset successfully',
        data: {
            email: manager.email,
            newPassword: newPassword // In production, don't return this
        }
    };
});

// Send manager invite
export const sendManagerInvite = errorWrapper(async (req, res) => {
    const { id } = req.params;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    const business = await Business.findById(manager.business);

    try {
        await sendManagerInvitationEmail(manager, business);
    } catch (error) {
        return {
            statusCode: 500,
            message: 'Failed to send invitation email',
            data: null
        };
    }

    return {
        statusCode: 200,
        message: 'Manager invitation sent successfully',
        data: null
    };
});

// Get manager audit
export const getManagerAudit = errorWrapper(async (req, res) => {
    const { id } = req.params;
    const { limit = 10, action, from, to } = req.query;

    const manager = await User.findOne({ _id: id, role: 'manager' });
    if (!manager) {
        return {
            statusCode: 404,
            message: 'Manager not found',
            data: null
        };
    }

    // This would implement actual audit trail
    // For now, return mock data
    const auditData = [{
        _id: 'audit-1',
        user: { _id: id, name: manager.name },
        action: action || 'login',
        details: { ip: '192.168.1.1', userAgent: 'Mozilla/5.0' },
        performedBy: { _id: req.user._id, name: req.user.name },
        timestamp: new Date()
    }];

    return {
        statusCode: 200,
        message: 'Manager audit retrieved successfully',
        data: auditData,
        metaData: {
            total: auditData.length,
            limit: parseInt(limit)
        }
    };
});

// Helper function to send manager invitation email
async function sendManagerInvitationEmail(manager, business) {
    const subject = `You've been invited to join ${business.name} on Ava SAAS`;
    const html = `
    <h2>Welcome to ${business.name}!</h2>
    <p>You have been invited to join ${business.name} as a manager on the Ava SAAS platform.</p>
    <p>Please click the link below to set up your account:</p>
    <a href="${process.env.FRONTEND_URL}/invite?email=${manager.email}&business=${business._id}">Set Up Account</a>
    <p>If you have any questions, please contact your administrator.</p>
  `;

    await sendMail({
        to: manager.email,
        subject,
        html
    });
}

// Helper function to send password reset email
async function sendPasswordResetEmail(manager, newPassword) {
    const subject = 'Your password has been reset';
    const html = `
    <h2>Password Reset</h2>
    <p>Your password has been reset by an administrator.</p>
    <p>Your new password is: <strong>${newPassword}</strong></p>
    <p>Please change this password after your next login.</p>
    <p>If you didn't request this reset, please contact your administrator immediately.</p>
  `;

    await sendMail({
        to: manager.email,
        subject,
        html
    });
} 