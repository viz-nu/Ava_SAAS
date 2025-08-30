import { Collection } from '../../models/Collection.js';
import { Data } from '../../models/Data.js';
import { AgentModel } from '../../models/Agent.js';
import { urlProcessingQueue } from "../../utils/bull.js";
import { User } from '../../models/User.js';
import graphqlFields from 'graphql-fields';
import { flattenFields } from '../../utils/graphqlTools.js';
import { adminNamespace, io } from "../../utils/io.js";
import { processURLS } from "../../utils/websiteHelpers.js";
import { processYT } from "../../utils/ytHelper.js";
import { processFile } from "../../utils/fileHelper.js";
import { Business } from '../../models/Business.js';
export const collectionResolvers = {
    Query: {
        collections: async (_, { id, limit = 10, isPublic }, context, info) => {
            const filter = {};
            filter.business = context.user.business;
            if (id) filter._id = id;
            if (isPublic !== undefined) filter.isPublic = isPublic;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            let collections = await Collection.find(filter)
                .select(projection)
                .limit(limit)
                .sort({ createdAt: -1 });
            await Business.populate(collections, { path: 'business', select: nested.business });
            await User.populate(collections, { path: 'createdBy', select: nested.createdBy });
            return collections;
        }
    },

    Mutation: {
        createCollection: async (_, { collection }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const { name, description, contents, isPublic, isFeatured } = collection;
            const newCollection = await Collection.create({ name, description, contents, business: context.user.business, createdBy: context.user._id })
                .select(projection);
            await Business.populate(newCollection, { path: 'business', select: nested.business });
            await User.populate(newCollection, { path: 'createdBy', select: nested.createdBy });
            (async function processCollection(newCollection, receiver = context.user.business) {
                try {
                    for (const content of newCollection.contents) {
                        const { source, metaData, _id } = content;
                        let result
                        adminNamespace.to(context.user.business.toString()).emit("trigger", { action: "collection-status", data: { collectionId: newCollection._id, status: "loading" } });
                        switch (source) {
                            case "website":
                                console.log("website process started");
                                if (metaData?.urls) result = await processURLS(newCollection._id, metaData.urls, receiver, _id);
                                break;
                            case "youtube":
                                console.log("youtube process started");
                                if (metaData?.urls) result = await processYT(newCollection._id, metaData.urls, receiver, _id);
                                break;
                            case "file":
                                console.log("file process started");
                                if (metaData?.urls) result = await processFile(newCollection._id, metaData.urls[0].url, receiver, _id);
                                break;
                            default:
                                console.warn(`Unknown source type: ${source}`);
                                break;
                        }
                    }
                } catch (error) {
                    console.error("Failed to sync collection:", error);
                }
            })(newCollection, receiver);
            return newCollection;
        },
        updateCollection: async (_, { id, action, name, description, removeContents, addContents }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const collection = await Collection.findOne({ _id: id, business: context.user.business });
            if (!collection) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            switch (action) {
                case "rename":
                    if (name) collection.name = name;
                    break;
                case "redescribe":
                    if (description) collection.description = description;
                    break;
                case "addContents":
                    collection.contents.push(...addContents)
                    break;
                case "removeContents":
                    let redundantContents = collection.contents.filter(ele => removeContents.includes(ele._id.toString()))
                    await Promise.all(
                        redundantContents.map(async (content) => {
                            const urls = content.metaData.urls.map(urlObj => urlObj.url);
                            return Data.deleteMany({ collection: collection._id, "metadata.url": { $in: urls } });
                        })
                    );
                    collection.contents = collection.contents.filter(ele => !removeContents.includes(ele._id.toString()))
                    break;
                default:
                    throw new GraphQLError("Invalid action", { extensions: { code: "INVALID_ACTION" } });
            }
            const updatedCollection = await collection.save().select(projection);
            await Business.populate(updatedCollection, { path: 'business', select: nested.business });
            await User.populate(updatedCollection, { path: 'createdBy', select: nested.createdBy });
            return updatedCollection;
        },
        deleteCollection: async (_, { id }, context) => {
            const jobs = await urlProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
            await Promise.all([
                Collection.findByIdAndDelete(id),
                AgentModel.updateMany({ collections: id, business: context.user.business }, { $pull: { collections: id } }),
                Data.deleteMany({ collection: id }),
                ...jobs.filter(job => job.data.collectionId === id).map(job => job.remove())
            ])
            return true;
        }
    },
}; 