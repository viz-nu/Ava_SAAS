import { errorWrapper } from "../../middleware/errorWrapper.js";
import { User } from "../../models/User.js";
import AuthService from "../../services/authService.js";
import bcrypt from "bcryptjs";
export const Login = errorWrapper(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email })
    if (!user || !user._id) return { statusCode: 401, message: "Invalid email" }
    if (!bcrypt.compareSync(password, user.password)) return { statusCode: 401, message: "Invalid password" }
    // if (!user.isVerified) return { statusCode: 403, message: "Email not confirmed. Please verify your email." }
    const { newAccessToken, newRefreshToken } = AuthService.generateTokens(user._id, '30d')
    res.cookie("AVA_RT", newRefreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "None",      // Allows cross-origin requests
        domain: ".avakado.ai",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    })
    return { statusCode: 200, message: `Login Successful`, data: { AccessToken: newAccessToken, role: user.role, scopes: user.scopes } }
})

export const superAdminLogin = errorWrapper(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email: email })
    if (!user) return { statusCode: 401, message: "Invalid email" }
    if (user.role !== "superAdmin") return { statusCode: 401, message: "Invalid Access Requested" }
    const { newAccessToken, newRefreshToken } =  AuthService.generateTokens(user._id, '30d')
    res.cookie("AVA_RT", newRefreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: "None",      // Allows cross-origin requests
        domain: ".avakado.ai",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    })
    return { statusCode: 200, message: `Login Successful`, data: { AccessToken: newAccessToken, role: user.role } }
})