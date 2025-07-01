import { Router } from "express";
import { authMiddleware, isAdmin } from "../middleware/auth.js";
import { createChannel, deleteChannel, fetchChannels, updateChannel } from "../controllers/channels/index.js";

export const channelRouter = Router()
channelRouter.post('/', authMiddleware, isAdmin, createChannel);
channelRouter.get('/:id?', authMiddleware, isAdmin, fetchChannels);
channelRouter.put('/:id', authMiddleware, isAdmin, updateChannel);
channelRouter.delete('/:id', authMiddleware, isAdmin, deleteChannel);