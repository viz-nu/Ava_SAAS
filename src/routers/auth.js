import { Router } from "express";
import { validateRegistration } from "../middleware/validations.js";
import { register } from "../controllers/auth/register.js";
import { Login } from "../controllers/auth/login.js";
export const authRouter = Router();
//        {{localhost:5000}}/api/v1/auth/team-login
// router.post("/team-login", TeamLogin)

authRouter.post("/register", validateRegistration, register)
authRouter.post("/login", Login);
// router.post("/verify-user", verifyStudentLoginOTP);
// router.post("/team-register", authMiddleware, isAdmin, TeamRegister);
// router.post("/logout", authMiddleware, Logout)
// router.post("/google/login", googleLogin)
