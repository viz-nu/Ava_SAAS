import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { Collection } from "../../models/Collection.js";
import { Data } from "../../models/Data.js";
import { collectionSchema, updateSchema } from "../../Schema/index.js";
import { urlProcessingQueue } from "../../utils/bull.js";
import { processFile } from "../../utils/fileHelper.js";
import { io } from "../../utils/io.js";
import { processURLS } from "../../utils/websiteHelpers.js";
import { processYT } from "../../utils/ytHelper.js";
// Create Collection
export const createCollection = errorWrapper(async (req, res) => {
    await collectionSchema.validate(req.body);
    const { name, contents } = req.body;
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const collection = new Collection({ name, contents, business: business._id, createdBy: req.user._id });
    await collection.save();
    (async function processCollection(collection, business) {
        try {
            for (const content of collection.contents) {
                const { source, metaData, _id } = content;
                let result, receivers = business.members
                receivers.forEach(receiver => io.to(receiver.toString()).emit("trigger", { action: "collection-status", data: { collectionId: collection._id, status: "loading" } }));
                switch (source) {
                    case "website":
                        console.log("website process started");
                        if (metaData?.urls) result = await processURLS(collection._id, metaData.urls, receivers, _id);
                        break;
                    case "youtube":
                        console.log("youtube process started");
                        if (metaData?.urls) result = await processYT(collection._id, metaData.urls, receivers, _id);
                        break;
                    case "file":
                        console.log("file process started");
                        if (metaData?.urls) result = await processFile(collection._id, metaData.urls[0].url, receivers, _id);
                        break;
                    default:
                        console.warn(`Unknown source type: ${source}`);
                        break;
                }
            }
        } catch (error) {
            console.error("Failed to sync collection:", error);
        }
    })(collection, business);
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
    const { action, name, removeContents, addContents } = req.body;
    const collection = await Collection.findOne({ _id: req.params.id, business: req.user.business });
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    switch (action) {
        case 'rename':
            if (name) collection.name = name;
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
        Data.deleteMany({ collection: req.params.id }),
        ...jobs.filter(job => job.data.collectionId === id).map(job => job.remove())
    ])
    return { statusCode: 200, message: "Collection deleted successfully", data: null }
});
