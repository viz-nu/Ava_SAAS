import { errorWrapper } from "../../middleware/errorWrapper.js";
import { AgentModel } from "../../models/Agent.js";
import { Business } from "../../models/Business.js";
import { Collection } from "../../models/Collection.js";
import { Data } from "../../models/Data.js";
import { User } from "../../models/User.js";
import { collectionSchema, updateSchema } from "../../Schema/index.js";
import { processFile } from "../../utils/fileHelper.js";
import { processURLS } from "../../utils/websiteHelpers.js";
import { processYT } from "../../utils/ytHelper.js";
import { sendMessageToRoom } from "../../utils/socketIoClient.js";
// Create Collection
export const createCollection = errorWrapper(async (req, res) => {
    await collectionSchema.validate(req.body);
    let { name, contents, description } = req.body;
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    contents = contents.map(content => {
        content.metaData.detailedReport = content.metaData.urls.map(u => ({ url: u.url, attempted: false, success: false, error: null }));
        return content;
    });
    const collection = new Collection({ name, description, contents: contents, business: business._id, createdBy: req.user._id });
    await collection.save();
    (async function processCollection(collection, receiver = req.user.business) {
        try {
            for (const content of collection.contents) {
                const { source, metaData, _id } = content;
                sendMessageToRoom(receiver.toString(), "collection-status", { collectionId: collection._id, status: "loading" }, "admin");
                switch (source) {
                    case "website":
                        console.log("website process started");
                        if (metaData?.urls) await processURLS(collection._id, metaData.urls, receiver, _id);
                        break;
                    case "youtube":
                        console.log("youtube process started");
                        if (metaData?.urls) await processYT(collection._id, metaData.urls, receiver, _id);
                        break;
                    case "file":
                        console.log("file process started");
                        if (metaData?.urls) await processFile(collection._id, metaData.urls[0].url, receiver, _id);
                        break;
                    default:
                        console.warn(`Unknown source type: ${source}`);
                        break;
                }
            }
        } catch (error) {
            console.error("Failed to sync collection:", error);
        }
    })(collection, req.user.business);
    return { statusCode: 201, message: "Registration successful", data: collection }
});

// Get All Collections
export const getCollections = errorWrapper(async (req, res) => {
    const filter = { business: req.user.business }
    if (req.params.id) filter._id = req.params.id
    const collection = await Collection.find(filter);
    return { statusCode: 200, message: "All collections", data: collection }
});

export const updateCollection = errorWrapper(async (req, res) => {
    await updateSchema.validate(req.body);
    const { action, name, description, removeContents, addContents } = req.body;
    const collection = await Collection.findOne({ _id: req.params.id, business: req.user.business });
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    switch (action) {
        case 'rename':
            if (name) collection.name = name;
            break;
        case 'redescribe':
            if (description) collection.description = description;
            break;
        case 'addContents':
            collection.contents.push(...addContents)
            break;
        case 'removeContents':
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
            return { statusCode: 400, message: "Invalid action", data: null }
    }
    await collection.save();
    return { statusCode: 200, message: "collection updated", data: collection }
});

// Delete Collection Route
export const deleteCollection = errorWrapper(async (req, res) => {
    // Find the collection by ID
    const collection = await Collection.findOne({ _id: req.params.id, business: req.user.business });
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    // Delete the collection
    const jobs = await urlProcessingQueue.getJobs(['waiting', 'active', 'delayed']);
    await Promise.all([
        Collection.findByIdAndDelete(req.params.id),
        AgentModel.updateMany({ collections: req.params.id, business: req.user.business }, { $pull: { collections: req.params.id } }),
        Data.deleteMany({ collection: req.params.id }),
        ...jobs.filter(job => job.data.collectionId === id).map(job => job.remove())
    ])
    return { statusCode: 200, message: "Collection deleted successfully", data: null }
});
