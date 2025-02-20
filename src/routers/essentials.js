import { Router } from "express";
import { OrgNameSuggestion, subURLSuggest, uploadFile } from "../controllers/essentials/index.js";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { handleFiles } from "../middleware/handleFile.js";

export const essentialsRouter = Router()
essentialsRouter.get('/business-suggest', OrgNameSuggestion);
essentialsRouter.get('/sub-urls', authMiddleware, isAdmin, subURLSuggest);
essentialsRouter.post('/upload', authMiddleware, isAdmin, handleFiles,uploadFile);
// essentialsRouter.get('/', authMiddleware, isAdmin,);
// essentialsRouter.get('/:id', authMiddleware, isAdmin,);
// essentialsRouter.put('/:id', authMiddleware, isAdmin,);
// essentialsRouter.delete('/:id', authMiddleware, isAdmin,);