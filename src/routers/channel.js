import { Router } from "express";
import { authMiddleware, requireScope, requireResourceOwnership } from "../middleware/auth.js";
import { createChannel, deleteChannel, fetchChannels, updateChannel } from "../controllers/channels/index.js";
import { Channel } from "../models/Channels.js";

export const channelRouter = Router()

// Channel CRUD operations with scope-based authorization
channelRouter.post('/', authMiddleware, requireScope('channel:create'), createChannel);
channelRouter.get('{/:id}', authMiddleware, requireScope('channel:read'), fetchChannels);
channelRouter.put('/:id', authMiddleware, requireScope('channel:update'), requireResourceOwnership(Channel, 'id'), updateChannel);
channelRouter.delete('/:id', authMiddleware, requireScope('channel:delete'), requireResourceOwnership(Channel, 'id'), deleteChannel);