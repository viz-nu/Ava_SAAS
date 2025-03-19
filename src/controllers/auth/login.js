import { errorWrapper } from "../../middleware/errorWrapper.js";
import { User } from "../../models/User.js";
import { generateTokens } from "../../utils/tokens.js";
import bcrypt from "bcryptjs";
export const Login = errorWrapper(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email })
    if (!user) return { statusCode: 401, message: "Invalid email" }
    if (!bcrypt.compareSync(password, user.password)) return { statusCode: 401, message: "Invalid password" }
    // if (!user.isVerified) return { statusCode: 403, message: "Email not confirmed. Please verify your email." }
    const { newAccessToken, newRefreshToken } = await generateTokens(user._id, req.headers['user-agent'])
    res.cookie("AVA_RT", newRefreshToken, {
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
    })
    // req.AccessToken = newAccessToken
    return { statusCode: 200, message: `Login Successful`, data: { AccessToken: newAccessToken, role: user.role } }
})

