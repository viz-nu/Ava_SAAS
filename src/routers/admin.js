import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createActions, Dashboard, deleteAction, DetailedAnalysis, editBusiness, geoLocationsData, getActionById, getActions, raiseTicket, updateAction } from "../controllers/admin/index.js";

export const AdminRouter = Router();
//        {{localhost:5000}}/api/v1/auth/team-login
// router.post("/team-login", TeamLogin)

AdminRouter.get('/dashboard', authMiddleware, isAdmin, Dashboard);
AdminRouter.get('/geo', authMiddleware, isAdmin, geoLocationsData);
AdminRouter.post('/query-analysis', authMiddleware, isAdmin, DetailedAnalysis);
AdminRouter.put('/edit-business', authMiddleware, isAdmin, editBusiness);
AdminRouter.post('/raise-ticket', authMiddleware, isAdmin, raiseTicket);
AdminRouter.post('/actions', authMiddleware, isAdmin, createActions);
AdminRouter.get('/actions', authMiddleware, isAdmin, getActions);
AdminRouter.get('/actions/:id', authMiddleware, isAdmin, getActionById);
AdminRouter.put('/actions/:id', authMiddleware, isAdmin, updateAction);
AdminRouter.delete('/actions/:id', authMiddleware, isAdmin, deleteAction);