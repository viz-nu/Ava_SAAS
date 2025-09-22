import { Router } from "express";
import { OrgNameSuggestion, OrgInfo } from "../controllers/auth/register.js";
import { demoCall } from "../controllers/public/index.js";




export const publicRouter = Router();
//        {{localhost:5000}}/api/v1/public/business-suggest
// router.post("/team-login", TeamLogin)

publicRouter.get("/business-suggest", OrgNameSuggestion)
publicRouter.get("/business-details/:name", OrgInfo)
publicRouter.post("/demo-call", demoCall)
// router.post("/login", checkDisposableEmail, customRateLimiter, Login);
// router.post("/verify-user", verifyStudentLoginOTP);
// router.post("/team-register", authMiddleware, isAdmin, TeamRegister);
// router.post("/logout", authMiddleware, Logout)
// router.post("/google/login", googleLogin)
