import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { Dashboard } from "../controllers/admin/index.js";

export const AdminRouter = Router();
//        {{localhost:5000}}/api/v1/auth/team-login
// router.post("/team-login", TeamLogin)

AdminRouter.get('/dashboard', authMiddleware, isAdmin, Dashboard);