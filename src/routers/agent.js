import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createAgent, deleteAgent, getAllAgents, getAgentById, updateAgent } from "../controllers/product.js/index.js";

export const AgentsRouter = Router()
AgentsRouter.post('/', authMiddleware, isAdmin, createAgent);
AgentsRouter.get('/', authMiddleware, isAdmin, getAllAgents);
AgentsRouter.get('/:id', authMiddleware, isAdmin, getAgentById);
AgentsRouter.put('/:id', authMiddleware, isAdmin, updateAgent);
AgentsRouter.delete('/:id', authMiddleware, isAdmin, deleteAgent);