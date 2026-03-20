import { Collection } from '../../models/Collection.js';
import { Data } from '../../models/Data.js';
import { AgentModel } from '../../models/Agent.js';
import { User } from '../../models/User.js';
import graphqlFields from 'graphql-fields';
import { flattenFields } from '../../utils/graphqlTools.js';
import { processURLS } from "../../utils/websiteHelpers.js";
import { processYT } from "../../utils/ytHelper.js";
import { Business } from '../../models/Business.js';
import { sendMessageToRoom } from '../../utils/socketIoClient.js';
import { cloudflareIntegration } from '../../services/cloudflare.js';
import { llamaParser } from '../../services/llamaparse.js';
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
        },
        getListOfUploadedFiles: async (_, { StartAfter, ContinuationToken, includeSize = false }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const listOfFiles = await cloudflareIntegration.listObjects({ Bucket: "ava-client-documents", Prefix: context.user.business.toString() + "/" });
            if (includeSize) listOfFiles.SizeUploaded = await cloudflareIntegration.getBucketSize({ Bucket: "ava-client-documents", Prefix: context.user.business.toString() + "/" });
            return listOfFiles;
        },
    },

    Mutation: {
        createCollection: async (_, { collection }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            let { name, description, source, chunkingDetails, parserDetails, isPublic, isFeatured } = collection;
            const newCollection = await Collection.create({ name, description, source, metaData: { chunkingDetails, parserDetails }, business: context.user.business, createdBy: context.user._id, isPublic, isFeatured });
            switch (source) {
                case "website":
                    break;
                case "youtube":
                    break;
                case "file":
                    const parsing = await llamaParser.parse(newCollection.metaData.parserDetails, { collection_id: newCollection._id });
                    newCollection.metaData.parserDetails.lastUpdate = parsing;
                    newCollection.metaData.parserDetails.jobId = parsing.id;
                    newCollection.metaData.progressStages = [{ name: "Parsing", status: "RUNNING", moreInfo: parsing }, { name: "Chunking" }, { name: "embed and upsert" }];
                    break;
            }
            // sendMessageToRoom(context.user.business.toString(), "collection-status", { collectionId: newCollection._id, status: "loading" }, "admin");
            // sendMessageToRoom(receiver.toString(), "adding-collection", { total: 1, progress: 0.3, collectionId: collectionId }, "admin");
            await newCollection.save();
            await Business.populate(newCollection, { path: 'business', select: nested.business });
            await User.populate(newCollection, { path: 'createdBy', select: nested.createdBy });
            // (async function processCollection(newCollection, receiver = context.user.business) {
            //     try {
            //         for (const content of newCollection.contents) {
            //             const { source, metaData, _id } = content;
            //             let result

            //             switch (source) {
            //                 case "website":
            //                     console.log("website process started");
            //                     if (metaData?.urls) result = await processURLS(newCollection._id, metaData.urls, receiver, _id);
            //                     break;
            //                 case "youtube":
            //                     console.log("youtube process started");
            //                     if (metaData?.urls) result = await processYT(newCollection._id, metaData.urls, receiver, _id);
            //                     break;
            //                 default:
            //                     console.warn(`Unknown source type: ${source}`);
            //                     break;
            //             }
            //         }
            //     } catch (error) {
            //         console.error("Failed to sync collection:", error);
            //     }
            // })(newCollection, receiver);
            return newCollection;
        },
        getUploadUrl: async (_, { key = "sampleDocument" }, context, info) => {
            const uploadUrl = await cloudflareIntegration.createTemporaryUploadURL({ Bucket: "ava-client-documents", Key: context.user.business.toString() + "/" + key });
            return uploadUrl;
        },
        getDownloadUrl: async (_, { key = "" }, context, info) => {
            const downloadUrl = await cloudflareIntegration.generateDownloadURL({ Bucket: "ava-client-documents", Key: context.user.business.toString() + "/" + key });
            return downloadUrl;
        },
        deleteUploadedFileFromStorage: async (_, { key = "" }, context, info) => {
            await cloudflareIntegration.deleteObject({ Bucket: "ava-client-documents", Key: context.user.business.toString() + "/" + key });
            return true;
        },
        updateCollection: async (_, { id, name, description }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const updateFields = {};
            if (name !== undefined && name !== "") updateFields.name = name;
            if (description !== undefined && description !== "") updateFields.description = description;
            const collection = await Collection.findOneAndUpdate({ _id: id, business: context.user.business }, updateFields, { new: true }).select(projection);
            if (!collection) throw new GraphQLError("Collection not found", { extensions: { code: "COLLECTION_NOT_FOUND" } });
            await Business.populate(collection, { path: 'business', select: nested.business });
            await User.populate(collection, { path: 'createdBy', select: nested.createdBy });
            return collection;
        },
        deleteCollection: async (_, { id }, context) => {
            // const jobs = await urlProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
            await Promise.all([
                Collection.findByIdAndDelete(id),
                AgentModel.updateMany({ collections: id, business: context.user.business }, { $pull: { collections: id } }),
                Data.deleteMany({ collection: id }),
                // ...jobs.filter(job => job.data.collectionId === id).map(job => job.remove())
            ])
            return true;
        }
    },
}; 