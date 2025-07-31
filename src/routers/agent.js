import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createAgent, deleteAgent, getAllAgents, promptGenerator, updateAgent } from "../controllers/agent/index.js";

export const AgentsRouter = Router()
AgentsRouter.post('/promptGeneration', authMiddleware, isAdmin, promptGenerator);
AgentsRouter.post('/', authMiddleware, isAdmin, createAgent);
AgentsRouter.get('{/:id}', authMiddleware, isAdmin, getAllAgents);
AgentsRouter.put('/:id', authMiddleware, isAdmin, updateAgent);
AgentsRouter.delete('/:id', authMiddleware, isAdmin, deleteAgent);