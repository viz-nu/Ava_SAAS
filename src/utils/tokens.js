import jwt from "jsonwebtoken";
const { ACCESS_SECRET, REFRESH_SECRET } = process.env
export const generateTokens = async (userId) => {
    const newAccessToken = jwt.sign({ id: userId }, process.env.ACCESS_SECRET, { expiresIn: '1h' });
    const newRefreshToken = jwt.sign({ id: userId }, process.env.REFRESH_SECRET, { expiresIn: '30d' });
    return { newAccessToken, newRefreshToken };
};
export const verifyTokens = async (accessToken, refreshToken) => {
    try {
        // Verify access token first if it exists
        if (accessToken) {
            const accessResult = await verifyAccessToken(accessToken);
            if (accessResult.success) return { success: true, message: accessResult.message, decoded: accessResult.decoded, accessToken: null, refreshToken: null };
            // Only attempt refresh if access token is expired and refresh token exists
            if (accessResult.message === "jwt expired" && refreshToken) return await handleRefreshToken(refreshToken);
            // Access token invalid for reasons other than expiration
            return { success: false, message: accessResult.message || 'Invalid Access Token', decoded: null, accessToken: null, refreshToken: null };
        }
        // Handle case where only refresh token is provided
        if (refreshToken) return await handleRefreshToken(refreshToken);
        // No tokens provided
        return { success: false, message: 'No authentication tokens provided', decoded: null, accessToken: null, refreshToken: null };
    } catch (error) {
        console.error('Token verification error:', error);
        return { success: false, message: 'Error verifying tokens', decoded: null, accessToken: null, refreshToken: null };
    }
};
const handleRefreshToken = async (refreshToken) => {
    const refreshResult = await verifyRefreshToken(refreshToken);
    if (refreshResult.success) return { success: true, message: refreshResult.message, decoded: refreshResult.decoded, accessToken: refreshResult.newAccessToken, refreshToken: refreshResult.newRefreshToken };
    return { success: false, message: refreshResult.message || 'Invalid Refresh Token', decoded: null, accessToken: null, refreshToken: null };
};
export const verifyRefreshToken = async (refreshToken) => {
    if (!refreshToken) return { success: false, message: 'No refresh token provided', decoded: null };
    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        if (!decoded || !decoded.id) return { success: false, message: 'Invalid refresh token payload', decoded: null };
        // Generate new tokens
        const { newAccessToken, newRefreshToken } = await generateTokens(decoded.id);
        return { success: true, message: "Valid Refresh Token", decoded, newAccessToken, newRefreshToken };
    } catch (error) {
        const message = error.name === 'JsonWebTokenError' ? 'Invalid refresh token' : error.name === 'TokenExpiredError' ? 'Refresh token expired' : error.message;
        return { success: false, message, decoded: null };
    }
};
export const verifyAccessToken = async (accessToken) => {
    if (!accessToken) return { success: false, message: 'No access token provided', decoded: null };
    try {
        const decoded = jwt.verify(accessToken, ACCESS_SECRET);
        if (!decoded || !decoded.id) return { success: false, message: 'Invalid access token payload', decoded: null };
        return { success: true, message: "Valid Access Token", decoded };
    } catch (error) {
        const message = error.name === 'JsonWebTokenError' ? 'Invalid access token' : error.name === 'TokenExpiredError' ? 'jwt expired' : error.message;
        return { success: false, message, decoded: null };
    }
};