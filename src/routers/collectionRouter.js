import { Router } from "express";
import { createCollection, deleteCollection, getCollections, updateCollection } from "../controllers/collection/index.js";
import { authMiddleware, isAdmin } from "../middleware/auth.js";

export const collectionRouter = Router()
collectionRouter.post('/', authMiddleware, isAdmin, createCollection);
collectionRouter.get('/:id?', authMiddleware, isAdmin, getCollections);
collectionRouter.put('/:id', authMiddleware, isAdmin, updateCollection);
collectionRouter.delete('/:id', authMiddleware, isAdmin, deleteCollection);