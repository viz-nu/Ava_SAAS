import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import 'dotenv/config'
import { User } from "../models/User.js";
const { ACCESS_SECRET, REFRESH_SECRET } = process.env
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import { Log } from "../models/Log.js";
import { Business } from "../models/Business.js";
import { createFolder } from "../utils/CRMintegrations.js";
import { fireAndForgetAxios } from "../utils/fireAndForget.js";
class AuthService {
    generateTokens(userId, expiresIn = '30d') {
        const newAccessToken = jwt.sign({ id: userId }, ACCESS_SECRET, { expiresIn: expiresIn });
        const newRefreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: expiresIn });
        return { newAccessToken, newRefreshToken };
    }
    verifyAccessToken(accessToken) {
        if (!accessToken) return { success: false, message: 'No access token provided', data: { decoded: null } };
        try {
            const decoded = jwt.verify(accessToken, ACCESS_SECRET);
            if (!decoded || !decoded.id) return { success: false, message: 'Invalid access token payload', data: { decoded: null } };
            return { success: true, message: "Valid Access Token", data: { decoded } };
        } catch (error) {
            const message = error.name === 'JsonWebTokenError' ? 'Invalid access token' : error.name === 'TokenExpiredError' ? 'jwt expired' : error.message;
            return { success: false, message, data: { decoded: null } };
        }
    }
    verifyRefreshToken(refreshToken) {
        if (!refreshToken) return { success: false, message: 'No refresh token provided', data: { decoded: null, accessToken: null, refreshToken: null } };
        try {
            const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
            if (!decoded || !decoded.id) return { success: false, message: 'Invalid refresh token payload', data: { decoded: null, accessToken: null, refreshToken: null } };
            const { newAccessToken, newRefreshToken } = this.generateTokens(decoded.id, '30d');
            return { success: true, message: "Valid Refresh Token", data: { decoded, accessToken: newAccessToken, refreshToken: newRefreshToken } };
        } catch (error) {
            const message = error.name === 'JsonWebTokenError' ? 'Invalid refresh token' : error.name === 'TokenExpiredError' ? 'jwt expired' : error.message;
            return { success: false, message, data: { decoded: null, accessToken: null, refreshToken: null } };
        }
    }
    verifyTokens(accessToken, refreshToken) {
        try {
            if (accessToken) {
                const accessResult = this.verifyAccessToken(accessToken);
                if (accessResult.success) return accessResult;
                if (accessResult.message === "jwt expired" && refreshToken) return this.verifyRefreshToken(refreshToken);
                return { success: false, message: accessResult.message || 'Invalid Access Token', data: { decoded: null, accessToken: null, refreshToken: null } };
            }
            if (refreshToken) return this.verifyRefreshToken(refreshToken);
            return { success: false, message: 'No authentication tokens provided', data: { decoded: null, accessToken: null, refreshToken: null } };
        } catch (error) {
            console.error('Token verification error:', error);
            return { success: false, message: 'Error verifying tokens', data: { decoded: null, accessToken: null, refreshToken: null } };
        }
    }
    async verifyDecodedToken(decoded) {
        if (!decoded || !decoded.id) throw new GraphQLError('Invalid decoded token payload', { extensions: { code: 'UNAUTHENTICATED' } });
        const user = await User.findById(decoded.id).select("-password");
        if (!user || !user._id) throw new GraphQLError('Invalid decoded token payload', { extensions: { code: 'UNAUTHENTICATED' } });
        return { success: true, message: "Valid Decoded Token", data: user };
    }
    async login(email, password, ipAddress, userAgent) {
        const user = await User.findOne({ email: email });
        if (!user || !user._id) throw new GraphQLError('Invalid email', { extensions: { code: 'UNAUTHENTICATED' } });
        if (!bcrypt.compareSync(password, user.password)) throw new GraphQLError('Invalid password', { extensions: { code: 'UNAUTHENTICATED' } });
        if (!user.isVerified) throw new GraphQLError('Email not verified', { extensions: { code: 'UNAUTHENTICATED' } });
        const { newAccessToken, newRefreshToken } = this.generateTokens(user._id, '30d');
        const userResponse = user.toObject();
        delete userResponse.password;
        await Log.create({ user: user._id, business: user.business, level: 'info', event: 'login', category: 'AUTHENTICATION', status: 'SUCCESS', message: 'Login successful', service: 'auth', meta: { ipAddress, userAgent } });
        return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: userResponse };
    }
    async register(user, ipAddress, userAgent) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const { name, email, password, BusinessName, logoURL } = user;
            if (!name || !email || !password || !BusinessName) throw new GraphQLError('Missing required fields', { extensions: { code: 'BAD_REQUEST' } });
            let [b, u] = await Promise.all([Business.findOne({ name: BusinessName }).lean(), User.findOne({ email }).lean()])
            if (b) throw new GraphQLError('Business already exists', { extensions: { code: 'BAD_REQUEST' } });
            if (u) throw new GraphQLError('email already exists', { extensions: { code: 'BAD_REQUEST' } });
            const [newOrganization, newUser] = await Promise.all([Business.create({ name: BusinessName, logoURL: logoURL }), User.create({ name: name, email: email, password: await bcrypt.hash(password, 12), role: "admin", isVerified: false, emailToken: (Math.random() + 1).toString(16).substring(2) })])
            const doc = await createFolder(newOrganization._id, process.env.DEFAULT_BUSINESS_FOLDER_ZOHO)
            newOrganization.docData = { folder: doc.id, name: doc.attributes.name, parent: doc.attributes.parent_id, download_url: doc.attributes.download_url, modified_by_zuid: doc.attributes.modified_by_zuid }
            newOrganization.createdBy = newUser._id
            newUser.business = newOrganization._id
            await Promise.all([newUser.save(), newOrganization.save(), Log.create({ user: newUser._id, business: newOrganization._id, level: 'info', event: 'email verification', category: 'AUTHENTICATION', status: 'SUCCESS', message: 'Email verification sent', service: 'auth', meta: { ipAddress, userAgent } })])
            await session.commitTransaction();
            session.endSession();
            fireAndForgetAxios("POST", `${process.env.WEBHOOKS_URL}aux/trigger-email`,
                {
                    mode: "SYSTEM",
                    config: { to: email },
                    body: {
                        template: "emailVerification",
                        data: {
                            subject: "[AVA] Click this link to confirm your email address",
                            url: `${process.env.WEBHOOKS_URL}aux/verification?service=email&code=${newUser.emailToken}&email=${email}`,
                            name
                        }
                    }
                }, { headers: { "Content-Type": "application/json" } })
            fireAndForgetAxios("POST", `${process.env.WEBHOOKS_URL}aux/trigger-email`, {
                mode: "SYSTEM",
                config: { to: email },
                body: {
                    template: "welcome",
                    data: {
                        subject: "[AVA] Welcome to AVA",
                        dashboardURL: `${process.env.SERVER_URL}dashboard`,
                        supportEmail: "support@avakado.ai",
                        name
                    }
                }
            }, { headers: { "Content-Type": "application/json" } })
            return { success: true, message: "Registration successful. Verification email sent." };
        } catch (error) {
            console.error(error);
            await session.abortTransaction();
            session.endSession();
            throw new GraphQLError('Internal server error', { extensions: { code: 'BAD_Server' } });
        }
    }
    refreshAccessToken(user) { }
    logout(user) { }
    requestPasswordReset(user) { }
    resetPassword(user) { }
    verifyEmail(user) { }
    verifyPhone(user) { }
    verifyOTP(user) { }
    verifyEmailOTP(user) { }
    verifyPhoneOTP(user) { }
}
export default new AuthService();