import { Router } from "express";
import { authMiddleware, requireScope, requireAnyScope, requireResourceOwnership } from "../middleware/auth.js";
import { createTemplate, deleteTemplate, fetchTemplates, partialUpdateTemplate, updateTemplate } from "../controllers/market/index.js";
import { Template } from "../models/market.js";

export const marketRouter = Router()

// Template CRUD operations with scope-based authorization
marketRouter.post('/', authMiddleware, requireScope('template:create'), createTemplate);
marketRouter.get('{/:id}', requireScope('template:read'), fetchTemplates);
marketRouter.put('/:id', authMiddleware, requireScope('template:update'), requireResourceOwnership(Template, 'id'), updateTemplate);
marketRouter.patch('/:id', authMiddleware, requireScope('template:update'), requireResourceOwnership(Template, 'id'), partialUpdateTemplate);
marketRouter.delete('/:id', authMiddleware, requireScope('template:delete'), requireResourceOwnership(Template, 'id'), deleteTemplate);