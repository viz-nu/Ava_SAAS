import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { Dashboard, editBusiness, raiseTicket } from "../controllers/admin/index.js";

export const AdminRouter = Router();
//        {{localhost:5000}}/api/v1/auth/team-login
// router.post("/team-login", TeamLogin)

AdminRouter.get('/dashboard', authMiddleware, isAdmin, Dashboard);
AdminRouter.put('/edit-business', authMiddleware, isAdmin, editBusiness);
AdminRouter.post('/raise-ticket', authMiddleware, isAdmin, raiseTicket);