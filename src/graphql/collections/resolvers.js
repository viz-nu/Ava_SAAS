import { Collection } from '../../models/Collection.js';
import { Business } from '../../models/Business.js';
import { User } from '../../models/User.js';

export const collectionResolvers = {
    Query: {
        collections: async (_, { limit = 10, type, isPublic, business }, context) => {
            const filter = {};

            // Filter by business (user's business or specified business)
            if (business) {
                filter.business = business;
            } else if (context.user.business) {
                filter.business = context.user.business;
            }

            if (type) filter.type = type;
            if (isPublic !== undefined) filter.isPublic = isPublic;

            return await Collection.find(filter)
                .populate('business')
                .populate('createdBy')
                .populate('permissions.user')
                .limit(limit)
                .sort({ createdAt: -1 });
        },

        collection: async (_, { id }, context) => {
            return await Collection.findById(id)
                .populate('business')
                .populate('createdBy')
                .populate('permissions.user');
        },

        publicCollections: async (_, { limit = 10, type }) => {
            const filter = { isPublic: true };
            if (type) filter.type = type;

            return await Collection.find(filter)
                .populate('business')
                .limit(limit)
                .sort({ createdAt: -1 });
        }
    },

    Mutation: {
        createCollection: async (_, { collection }, context) => {
            const newCollection = new Collection({
                ...collection,
                business: collection.business || context.user.business,
                createdBy: context.user._id
            });

            return await newCollection.save();
        },

        updateCollection: async (_, { id, collection }, context) => {
            return await Collection.findByIdAndUpdate(
                id,
                { ...collection, updatedAt: new Date() },
                { new: true }
            ).populate('business').populate('createdBy').populate('permissions.user');
        },

        deleteCollection: async (_, { id }, context) => {
            const result = await Collection.findByIdAndDelete(id);
            return !!result;
        },

        uploadToCollection: async (_, { collectionId, files }, context) => {
            // This would integrate with your file upload service
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            // Add files to collection content
            collection.content = [...(collection.content || []), ...files];
            collection.updatedAt = new Date();

            return await collection.save();
        },

        updateCollectionPermissions: async (_, { collectionId, permissions }, context) => {
            const collection = await Collection.findById(collectionId);
            if (!collection) {
                throw new Error('Collection not found');
            }

            collection.permissions = permissions;
            collection.updatedAt = new Date();

            return await collection.save();
        }
    },

    Collection: {
        business: async (parent) => {
            if (parent.business) {
                return await Business.findById(parent.business);
            }
            return null;
        },

        createdBy: async (parent) => {
            if (parent.createdBy) {
                return await User.findById(parent.createdBy).select('-password');
            }
            return null;
        }
    },

    Permission: {
        user: async (parent) => {
            if (parent.user) {
                return await User.findById(parent.user).select('-password');
            }
            return null;
        }
    }
}; 