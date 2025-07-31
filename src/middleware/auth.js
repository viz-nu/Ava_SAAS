import { User } from "../models/User.js";
import { verifyTokens } from "../utils/tokens.js";
export const authMiddleware = async (req, res, next) => {
    try {
        if (!req.headers.authorization) return res.status(401).json({ success: false, message: 'Access Token Missing', data: null });
        const token = req.headers.authorization.split(" ")[1];
        if (!token || token.trim() === "" || token === 'null' || token === 'undefined') return res.status(401).json({ success: false, message: 'Access Token Missing', data: null });
        // const source = req.headers['user-agent']; // Use device token or user-agent string as the identifier
        // console.dir({ source, token, cookie: req.cookies.AVA_RT })
        const { success, message, decoded, accessToken, refreshToken } = await verifyTokens(token, req.cookies.AVA_RT)
        if (!success) return res.status(401).json({ success: false, message: 'Token Verification Failed', data: message });
        let user = await User.findOne({ _id: decoded.id }).select("-password");
        if (!user) return res.status(401).json({ success: false, message: `Invalid Tokens`, data: null });
        req.decoded = decoded;
        req.user = user;
        if (accessToken && refreshToken) {
            res.cookie("AVA_RT", refreshToken, {
                secure: true,
                httpOnly: true,
                sameSite: "None",      // Allows cross-origin requests
                domain: ".avakado.ai",
                maxAge: 30 * 24 * 60 * 60 * 1000
            })
            req.AccessToken = accessToken;
        }
        return next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
}
export const conditionalAuth = (conditionFn, middleware) => {
    return (req, res, next) => {
        if (conditionFn(req)) {  // Call the condition function with `req`
            return middleware(req, res, next); // Execute middleware if condition is true
        }
        next(); // Skip middleware if condition is false
    };
};
export const isAdmin = (req, res, next) => {
    if (req.user.role === "admin") return next();
    return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
}
export const isSuperAdmin = (req, res, next) => {
    if (req.user.role === "superAdmin") return next();
    return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
}
export const authForGraphQL = async (req, res) => {
    try {
        const isIntrospectionQuery = req.body?.query?.includes('IntrospectionQuery') || req.body?.query?.includes('__schema');
        if (isIntrospectionQuery) {
            console.log('Allowing introspection query without auth');
            return { user: null, isAuthenticated: false, isIntrospection: true };
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new Error('Access Token Missing');
        const token = authHeader.split(" ")[1];
        if (!token || token.trim() === "" || token === 'null' || token === 'undefined') throw new Error('Access Token Missing');
        const { success, message, decoded, accessToken, refreshToken } = await verifyTokens(token, req.cookies?.AVA_RT);
        if (!success) throw new Error(`Token Verification Failed: ${message}`);
        const user = await User.findById(decoded.id).select("-password");
        if (!user) throw new Error('Invalid Tokens');
        // Set refresh token in cookie if provided
        if (accessToken && refreshToken) res.cookie("AVA_RT", refreshToken, { secure: true, httpOnly: true, sameSite: "None", domain: ".avakado.ai", maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { req, res, user, isAuthenticated: true, accessToken };
    } catch (error) {
        throw new Error('Internal Server Error');
    }
};

// export const isStudent = (req, res, next) => {
//     if (req.user.userType === "student") return next();
//     return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
// }
// export const isProcessCoordinator = (req, res, next) => {
//     if (req.user.role === TeamRoleEnum.TEAM) return next();
//     return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
// }
// export const isDeveloper = (req, res, next) => {
//     if (req.user.role === TeamRoleEnum.DEVELOPER) return next();
//     return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
// }
// export const isCounsellor = (req, res, next) => {
//     if (req.user.role === TeamRoleEnum.COUNSELLOR) return next();
//     return res.status(401).json({ success: false, message: 'Unauthorized entry', data: null });
// }