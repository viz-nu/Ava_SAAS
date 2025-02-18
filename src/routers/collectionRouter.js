import { Router } from "express";
import { createCollection, deleteCollection, getCollectionById, getCollections, updateCollection } from "../controllers/collection/index.js";
import { authMiddleware, isAdmin } from "../middleware/auth.js";

export const collectionRouter = Router()
collectionRouter.post('/', authMiddleware, isAdmin, createCollection);
collectionRouter.get('/', authMiddleware, isAdmin, getCollections);
collectionRouter.get('/:id', authMiddleware, isAdmin, getCollectionById);
collectionRouter.put('/:id', authMiddleware, isAdmin, updateCollection);
collectionRouter.delete('/:id', authMiddleware, isAdmin, deleteCollection);