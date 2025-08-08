import { Router } from "express";
import { authMiddleware, requireScope, requireAnyScope } from "../middleware/auth.js";
import { Dashboard, DetailedAnalysis, editBusiness, newDashboard, raiseTicket } from "../controllers/admin/index.js";
import {
    getAllAvailableScopes,
    getScopesByCategoryController,
    getDefaultScopesForRoleController,
    validateScopesController,
    getUserScopeAudit,
    updateUserScopes,
    getScopeHierarchyController,
    bulkUpdateUserScopes
} from "../controllers/admin/scopeManagement.js";

export const AdminRouter = Router();

// Dashboard routes - require analytics and business read scopes
AdminRouter.get('/dashboard', authMiddleware, requireScope('analytics:read'), Dashboard);
AdminRouter.get('/new-dashboard', authMiddleware, requireScope('analytics:read'), newDashboard);

// Analysis routes - require analytics scopes
AdminRouter.post('/query-analysis', authMiddleware, requireAnyScope(['analytics:read', 'analytics:custom_reports']), DetailedAnalysis);

// Business management routes - require business update scope
AdminRouter.put('/edit-business', authMiddleware, requireScope('business:update'), editBusiness);

// Ticket management routes - require ticket create scope
AdminRouter.post('/raise-ticket', authMiddleware, requireScope('ticket:create'), raiseTicket);