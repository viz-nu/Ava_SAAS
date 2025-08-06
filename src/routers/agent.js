import { Router } from "express";
import { authMiddleware, requireScope, requireAnyScope, requireResourceOwnership } from "../middleware/auth.js";
import { createAgent, deleteAgent, getAllAgents, promptGenerator, updateAgent } from "../controllers/agent/index.js";
import { AgentModel } from "../models/Agent.js";

export const AgentsRouter = Router()

// Prompt generation - requires agent management scope
AgentsRouter.post('/promptGeneration', authMiddleware, requireScope('agent:manage_prompts'), promptGenerator);

// Agent CRUD operations
AgentsRouter.post('/', authMiddleware, requireScope('agent:create'), createAgent);
AgentsRouter.get('{/:id}', authMiddleware, requireScope('agent:read'), getAllAgents);
AgentsRouter.put('/:id', authMiddleware, requireScope('agent:update'), requireResourceOwnership(AgentModel, 'id'), updateAgent);
AgentsRouter.delete('/:id', authMiddleware, requireScope('agent:delete'), requireResourceOwnership(AgentModel, 'id'), deleteAgent);