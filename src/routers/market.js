import { Router } from "express";
import { authMiddleware, isSuperAdmin } from "../middleware/auth.js";
import { createTemplate, deleteTemplate, fetchTemplates, partialUpdateTemplate, updateTemplate } from "../controllers/market/index.js";

export const marketRouter = Router()
marketRouter.post('/', authMiddleware, isSuperAdmin, createTemplate);
marketRouter.get('/', fetchTemplates);
marketRouter.put('/:id', authMiddleware, isSuperAdmin, updateTemplate);
marketRouter.patch('/:id', authMiddleware, isSuperAdmin, partialUpdateTemplate);
marketRouter.delete('/:id', authMiddleware, isSuperAdmin, deleteTemplate);