import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createAgent, deleteAgent, getAgentById, getAllAgents, updateAgent } from "../controllers/agent/index.js";

export const AgentsRouter = Router()
AgentsRouter.post('/', authMiddleware, isAdmin, createAgent);
AgentsRouter.get('/', authMiddleware, isAdmin, getAllAgents);
AgentsRouter.get('/:id', getAgentById);
AgentsRouter.put('/:id', authMiddleware, isAdmin, updateAgent);
AgentsRouter.delete('/:id', authMiddleware, isAdmin, deleteAgent);