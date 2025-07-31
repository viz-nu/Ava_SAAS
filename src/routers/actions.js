import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createActions, deleteAction, getActions, updateAction } from "../controllers/actions/index.js";

export const actionsRouter = Router()
actionsRouter.post('/', authMiddleware, isAdmin, createActions);
actionsRouter.get('{/:id}', authMiddleware, isAdmin, getActions);
actionsRouter.put('/:id', authMiddleware, isAdmin, updateAction);
actionsRouter.delete('/:id', authMiddleware, isAdmin, deleteAction);
