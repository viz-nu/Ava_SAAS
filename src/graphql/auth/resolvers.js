import { User } from '../../models/User.js';
import { Business } from '../../models/Business.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendMail } from '../../utils/sendEmail.js';
import { getDefaultScopesForRole } from '../../utils/scopeManager.js';
import { generateTokens } from '../../utils/tokens.js';

export const authResolvers = {
    Query: {
        validateToken: async (_, __, context) => {
            if (!context.user) {
                return {
                    valid: false,
                    user: null,
                    scopes: [],
                    business: null
                };
            }

            return {
                valid: true,
                user: context.user,
                scopes: context.user.scopes || [],
                business: context.user.business
            };
        },

        me: async (_, __, context) => {
            if (!context.user) {
                throw new Error('Authentication required');
            }

            return await User.findById(context.user._id)
                .populate('business')
                .select('-password');
        },

        checkEmailAvailability: async (_, { email }) => {
            const existingUser = await User.findOne({ email });
            return !existingUser; // Return true if email is available (no user found)
        }
    },

    Mutation: {
        login: async (_, { credentials }, context) => {
            const { email, password } = credentials;
            const { req, res } = context
            // Find user by email
            const user = await User.findOne({ email }).populate('business');
            if (!user || !user._id) return { success: false, message: 'Invalid email', data: null };
            // Check if user is verified
            // if (!user.isVerified) return { success: false, message: 'Please verify your email before logging in', data:null};
            // Verify password
            if (!bcrypt.compareSync(password, user.password)) return { success: false, data: null, message: "Invalid password" }
            const { newAccessToken, newRefreshToken } = await generateTokens(user._id)
            res.cookie("AVA_RT", newRefreshToken, {
                secure: true,
                httpOnly: true,
                sameSite: "None",      // Allows cross-origin requests
                domain: ".avakado.ai",
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
            })
            return { success: true, message: `Login Successful`, data: { AccessToken: newAccessToken, role: user.role, scopes: user.scopes } }
        },

        superAdminLogin: async (_, { credentials }, context) => {
            const { email, password } = credentials;

            // Find user by email
            const user = await User.findOne({ email, role: 'superAdmin' }).populate('business');
            if (!user) {
                return {
                    success: false,
                    message: 'Invalid super admin credentials',
                    token: null,
                    refreshToken: null,
                    user: null,
                    expiresIn: null
                };
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return {
                    success: false,
                    message: 'Invalid super admin credentials',
                    token: null,
                    refreshToken: null,
                    user: null,
                    expiresIn: null
                };
            }

            // Generate tokens
            const token = jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    business: user.business
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const refreshToken = jwt.sign(
                { userId: user._id },
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Update user's refresh token
            user.refreshToken = refreshToken;
            await user.save();

            return {
                success: true,
                message: 'Super admin login successful',
                token,
                refreshToken,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    scopes: user.scopes,
                    business: user.business,
                    isVerified: user.isVerified
                },
                expiresIn: 24 * 60 * 60 // 24 hours in seconds
            };
        },

        register: async (_, { userData }, context) => {
            const { name, email, password, businessName, businessSector, role = 'manager' } = userData;

            // Check if email already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return {
                    success: false,
                    message: 'User with this email already exists',
                    user: null,
                    verificationRequired: false
                };
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            let business = null;

            // Create business if businessName is provided
            if (businessName) {
                business = new Business({
                    name: businessName,
                    sector: businessSector || 'General',
                    createdBy: null // Will be updated after user creation
                });
                await business.save();
            }

            // Create user
            const user = new User({
                name,
                email,
                password: hashedPassword,
                role,
                business: business ? business._id : null,
                scopes: getDefaultScopesForRole(role),
                isVerified: false,
                emailToken: jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' })
            });

            await user.save();

            // Update business with createdBy if business was created
            if (business) {
                business.createdBy = user._id;
                await business.save();
            }

            // Send verification email
            try {
                await sendVerificationEmail(user, business);
            } catch (error) {
                console.error('Failed to send verification email:', error);
            }

            return {
                success: true,
                message: 'Registration successful. Please check your email to verify your account.',
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    business: business,
                    isVerified: user.isVerified
                },
                verificationRequired: true
            };
        },

        requestPasswordReset: async (_, { request }, context) => {
            const { email } = request;

            const user = await User.findOne({ email });
            if (!user) {
                // Don't reveal if user exists or not for security
                return {
                    success: true,
                    message: 'If an account with this email exists, a password reset link has been sent.',
                    emailSent: true
                };
            }

            // Generate reset token
            const resetToken = jwt.sign(
                { userId: user._id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            // Store reset token in user document
            user.resetPasswordToken = resetToken;
            user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
            await user.save();

            // Send password reset email
            try {
                await sendPasswordResetEmail(user, resetToken);
                return {
                    success: true,
                    message: 'Password reset email sent successfully',
                    emailSent: true
                };
            } catch (error) {
                console.error('Failed to send password reset email:', error);
                return {
                    success: false,
                    message: 'Failed to send password reset email',
                    emailSent: false
                };
            }
        },

        resetPassword: async (_, { resetData }, context) => {
            const { token, newPassword } = resetData;

            try {
                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                const user = await User.findOne({
                    _id: decoded.userId,
                    resetPasswordToken: token,
                    resetPasswordExpires: { $gt: Date.now() }
                });

                if (!user) {
                    return {
                        success: false,
                        message: 'Invalid or expired reset token',
                        emailSent: false
                    };
                }

                // Hash new password
                const hashedPassword = await bcrypt.hash(newPassword, 12);

                // Update user password and clear reset token
                user.password = hashedPassword;
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;
                await user.save();

                return {
                    success: true,
                    message: 'Password reset successful',
                    emailSent: false
                };
            } catch (error) {
                return {
                    success: false,
                    message: 'Invalid or expired reset token',
                    emailSent: false
                };
            }
        },

        changePassword: async (_, { passwordData }, context) => {
            const { currentPassword, newPassword } = passwordData;

            if (!context.user) {
                throw new Error('Authentication required');
            }

            const user = await User.findById(context.user._id);
            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 12);
            user.password = hashedPassword;
            await user.save();

            // Generate new tokens
            const token = jwt.sign(
                {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    business: user.business
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const refreshToken = jwt.sign(
                { userId: user._id },
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            user.refreshToken = refreshToken;
            await user.save();

            return {
                success: true,
                message: 'Password changed successfully',
                token,
                refreshToken,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    scopes: user.scopes,
                    business: user.business,
                    isVerified: user.isVerified
                },
                expiresIn: 24 * 60 * 60
            };
        },

        verifyEmail: async (_, { verificationData }, context) => {
            const { token } = verificationData;

            try {
                // Verify token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                const user = await User.findOne({
                    email: decoded.email,
                    emailToken: token
                });

                if (!user) {
                    return {
                        success: false,
                        message: 'Invalid verification token',
                        user: null
                    };
                }

                // Mark user as verified
                user.isVerified = true;
                user.emailToken = undefined;
                await user.save();

                return {
                    success: true,
                    message: 'Email verified successfully',
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        business: user.business,
                        isVerified: user.isVerified
                    }
                };
            } catch (error) {
                return {
                    success: false,
                    message: 'Invalid verification token',
                    user: null
                };
            }
        },

        resendVerificationEmail: async (_, __, context) => {
            if (!context.user) {
                throw new Error('Authentication required');
            }

            const user = await User.findById(context.user._id);
            if (!user) {
                throw new Error('User not found');
            }

            if (user.isVerified) {
                return {
                    success: false,
                    message: 'Email is already verified',
                    emailSent: false
                };
            }

            // Generate new verification token
            const emailToken = jwt.sign(
                { email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            user.emailToken = emailToken;
            await user.save();

            // Send verification email
            try {
                const business = await Business.findById(user.business);
                await sendVerificationEmail(user, business);
                return {
                    success: true,
                    message: 'Verification email sent successfully',
                    emailSent: true
                };
            } catch (error) {
                console.error('Failed to send verification email:', error);
                return {
                    success: false,
                    message: 'Failed to send verification email',
                    emailSent: false
                };
            }
        },

        refreshToken: async (_, { tokenData }, context) => {
            const { refreshToken } = tokenData;

            try {
                // Verify refresh token
                const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

                const user = await User.findOne({
                    _id: decoded.userId,
                    refreshToken: refreshToken
                });

                if (!user) {
                    throw new Error('Invalid refresh token');
                }

                // Generate new tokens
                const newToken = jwt.sign(
                    {
                        userId: user._id,
                        email: user.email,
                        role: user.role,
                        business: user.business
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );

                const newRefreshToken = jwt.sign(
                    { userId: user._id },
                    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                // Update refresh token
                user.refreshToken = newRefreshToken;
                await user.save();

                return {
                    success: true,
                    message: 'Token refreshed successfully',
                    token: newToken,
                    refreshToken: newRefreshToken,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        scopes: user.scopes,
                        business: user.business,
                        isVerified: user.isVerified
                    },
                    expiresIn: 24 * 60 * 60
                };
            } catch (error) {
                throw new Error('Invalid refresh token');
            }
        },

        logout: async (_, __, context) => {
            if (!context.user) {
                return {
                    success: false,
                    message: 'No active session to logout'
                };
            }

            // Clear refresh token
            const user = await User.findById(context.user._id);
            if (user) {
                user.refreshToken = undefined;
                await user.save();
            }

            return {
                success: true,
                message: 'Logged out successfully'
            };
        },

        updateProfile: async (_, { profileData }, context) => {
            if (!context.user) {
                throw new Error('Authentication required');
            }

            const { name, email } = profileData;

            const user = await User.findById(context.user._id);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if email is being changed and if it already exists
            if (email && email !== user.email) {
                const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
                if (existingUser) {
                    throw new Error('Email already in use');
                }
            }

            // Update user profile
            if (name) user.name = name;
            if (email) user.email = email;
            user.updatedAt = new Date();

            await user.save();

            return await User.findById(user._id)
                .populate('business')
                .select('-password');
        },

        createUserByAdmin: async (_, { userData }, context) => {
            const { name, email, password, businessName, businessSector, role = 'manager' } = userData;

            // Check if email already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 12);

            let business = context.user.business;

            // Create business if businessName is provided and user is super admin
            if (businessName && context.user.role === 'superAdmin') {
                business = new Business({
                    name: businessName,
                    sector: businessSector || 'General',
                    createdBy: context.user._id
                });
                await business.save();
            }

            // Create user
            const user = new User({
                name,
                email,
                password: hashedPassword,
                role,
                business: business,
                scopes: getDefaultScopesForRole(role),
                isVerified: true, // Admin-created users are verified by default
                createdBy: context.user._id
            });

            await user.save();

            return await User.findById(user._id)
                .populate('business')
                .select('-password');
        },

        verifyUserByAdmin: async (_, { userId }, context) => {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            user.isVerified = true;
            user.emailToken = undefined;
            await user.save();

            return await User.findById(userId)
                .populate('business')
                .select('-password');
        },

        resetUserPasswordByAdmin: async (_, { userId }, context) => {
            const user = await User.findById(userId);
            if (!user) {
                return {
                    success: false,
                    message: 'User not found',
                    emailSent: false
                };
            }

            // Generate a random password
            const newPassword = Math.random().toString(36).slice(-8);
            const hashedPassword = await bcrypt.hash(newPassword, 12);

            user.password = hashedPassword;
            user.updatedAt = new Date();
            await user.save();

            // Send password reset email
            try {
                await sendPasswordResetEmail(user, newPassword);
                return {
                    success: true,
                    message: 'Password reset successful',
                    emailSent: true
                };
            } catch (error) {
                console.error('Failed to send password reset email:', error);
                return {
                    success: false,
                    message: 'Password reset successful but failed to send email',
                    emailSent: false
                };
            }
        }
    }
};

// Helper function to send verification email
async function sendVerificationEmail(user, business) {
    const subject = 'Verify your email address';
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${user.emailToken}`;

    const html = `
    <h2>Welcome to Ava SAAS!</h2>
    <p>Hi ${user.name},</p>
    <p>Thank you for registering with Ava SAAS${business ? ` for ${business.name}` : ''}.</p>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verificationUrl}">Verify Email Address</a>
    <p>If you didn't create this account, please ignore this email.</p>
    <p>This link will expire in 24 hours.</p>
  `;

    await sendMail({
        to: user.email,
        subject,
        html
    });
}

// Helper function to send password reset email
async function sendPasswordResetEmail(user, resetToken) {
    const subject = 'Reset your password';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const html = `
    <h2>Password Reset Request</h2>
    <p>Hi ${user.name},</p>
    <p>You requested to reset your password for your Ava SAAS account.</p>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}">Reset Password</a>
    <p>If you didn't request this reset, please ignore this email.</p>
    <p>This link will expire in 1 hour.</p>
  `;

    await sendMail({
        to: user.email,
        subject,
        html
    });
} 