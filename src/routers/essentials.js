import { Router } from "express";
import { OrgNameSuggestion, subURLSuggest, uploadFile } from "../controllers/essentials/index.js";
import { authMiddleware, requireScope, requireAnyScope } from "../middleware/auth.js";
import { handleFiles } from "../middleware/handleFile.js";

export const essentialsRouter = Router()

// Public business suggestions - no auth required
essentialsRouter.get('/business-suggest', OrgNameSuggestion);

// Business management - requires business read scope
essentialsRouter.get('/sub-urls', authMiddleware, requireScope('business:read'), subURLSuggest);

// File upload - requires file upload scope
essentialsRouter.post('/upload', authMiddleware, requireScope('file:upload'), handleFiles, uploadFile);