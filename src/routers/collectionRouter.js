import { Router } from "express";
import { createCollection, deleteCollection, getCollections, updateCollection } from "../controllers/collection/index.js";
import { authMiddleware, requireScope, requireResourceOwnership } from "../middleware/auth.js";
import { Collection } from "../models/Collection.js";

export const collectionRouter = Router()

// Collection CRUD operations with scope-based authorization
collectionRouter.post('/', authMiddleware, requireScope('collection:create'), createCollection);
collectionRouter.get('{/:id}', authMiddleware, requireScope('collection:read'), getCollections);
collectionRouter.put('/:id', authMiddleware, requireScope('collection:update'), requireResourceOwnership(Collection, 'id'), updateCollection);
collectionRouter.delete('/:id', authMiddleware, requireScope('collection:delete'), requireResourceOwnership(Collection, 'id'), deleteCollection);