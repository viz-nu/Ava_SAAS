import { Router } from "express";
import { OrgNameSuggestion, subURLSuggest } from "../controllers/essentials/index.js";
import { authMiddleware, isAdmin } from "../middleware/auth.js";

export const essentialsRouter = Router()
essentialsRouter.get('/business-suggest', OrgNameSuggestion);
essentialsRouter.get('/sub-urls', authMiddleware, isAdmin, subURLSuggest);
// essentialsRouter.get('/', authMiddleware, isAdmin,);
// essentialsRouter.get('/:id', authMiddleware, isAdmin,);
// essentialsRouter.put('/:id', authMiddleware, isAdmin,);
// essentialsRouter.delete('/:id', authMiddleware, isAdmin,);