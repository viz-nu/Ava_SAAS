import { Router } from "express";
import { authMiddleware, requireScope, requireResourceOwnership } from "../middleware/auth.js";
import { createActions, deleteAction, getActions, updateAction } from "../controllers/actions/index.js";
import { Action } from "../models/Action.js";

export const actionsRouter = Router()

// Action CRUD operations with scope-based authorization
actionsRouter.post('/', authMiddleware, requireScope('action:create'), createActions);
actionsRouter.get('{/:id}', authMiddleware, requireScope('action:read'), getActions);
actionsRouter.put('/:id', authMiddleware, requireScope('action:update'), requireResourceOwnership(Action, 'id'), updateAction);
actionsRouter.delete('/:id', authMiddleware, requireScope('action:delete'), requireResourceOwnership(Action, 'id'), deleteAction);
