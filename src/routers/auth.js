import { Router } from "express";
import { Login, superAdminLogin } from "../controllers/auth/login.js";
export const authRouter = Router();
//        {{localhost:5000}}/api/v1/auth/team-login
// router.post("/team-login", TeamLogin)
authRouter.post("/login", Login);
authRouter.post('/super-admin-login', superAdminLogin)
// router.post("/verify-user", verifyStudentLoginOTP);
// router.post("/team-register", authMiddleware, isAdmin, TeamRegister);
// router.post("/logout", authMiddleware, Logout)
// router.post("/google/login", googleLogin)
