import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { Collection } from "../../models/Collection.js";
import { Data } from "../../models/Data.js";
import { collectionSchema, updateSchema } from "../../Schema/index.js";
import { processFile } from "../../utils/fileHelper.js";
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
    business.collections.push(collection._id);
    await business.save();
    (async function processCollection(collection, business) {
        try {
            for (const content of collection.contents) {
                const { source, metaData, _id } = content;
                let result, receivers = business.members
                switch (source) {
                    case "website":
                        // Handle website processing here if needed
                        console.log("website process started");
                        if (metaData?.urls) result = await processURLS(collection._id, metaData.urls, receivers, _id);
                        break;
                    case "youtube":
                        // urls =[{url:"https....",lang:"en"}]
                        console.log("youtube process started");
                        // metaData = {
                        //     "urls": [
                        //         {
                        //             "url": "https://www.youtube.com/watch?v=R3l3TvkwIAo&ab_channel=CaffeinatedCameras",
                        //             data:{"lang": "en"}
                        //         }],
                        // }
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
                await Collection.updateOne(
                    { _id: collection._id, "contents._id": _id },
                    {
                        $set: {
                            "contents.$.status": result.success ? "active" : "failed",
                            "contents.$.error": result.success ? null : result.error,
                            // "contents.$.metaData.detailedReport": result.data,
                        }
                    }
                );
            }
        } catch (error) {
            console.error("Failed to sync collection:", error);
        }
    })(collection, business);
    return { statusCode: 201, message: "Registration successful", data: collection }
});

// Get All Collections
export const getCollections = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate("collections");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return { statusCode: 200, message: "All collections", data: business.collections }
});

// Get Collection by ID
export const getCollectionById = errorWrapper(async (req, res) => {
    const collection = await Collection.findById(req.params.id);
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    const business = await Business.findById(req.user.business);
    if (!business || !business.collections.includes(collection._id)) return { statusCode: 403, message: "Unauthorized", data: null }
    return { statusCode: 200, message: "specific collection", data: collection }
});

// Update Collection (Metadata & statusCode)
export const updateCollection = errorWrapper(async (req, res) => {
    await updateSchema.validate(req.body);
    const { action, name, removeContents, addContents } = req.body;
    const collection = await Collection.findById(req.params.id);
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.collections.includes(req.params.id)) return { statusCode: 403, message: "You are not authorized to modify this collection", data: null }
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
    (async function processCollection(collection) {
        try {
            for (const content of collection.contents) {
                if (content.status != "active" && content.status != "failed") {
                    const { source, metaData, _id } = content;
                    let result
                    switch (source) {
                        case "website":
                            // Handle website processing here if needed
                            console.log("website process started");
                            if (metaData?.urls) result = await processURLS(collection._id, metaData.urls);
                            break;
                        case "youtube":
                            // urls =[{url:"https....",lang:"en"}]
                            console.log("youtube process started");
                            // metaData = {
                            //     "urls": [
                            //         {
                            //             "url": "https://www.youtube.com/watch?v=R3l3TvkwIAo&ab_channel=CaffeinatedCameras",
                            //             data:{"lang": "en"}
                            //         }],
                            // }
                            if (metaData?.urls) result = await processYT(collection._id, metaData.urls);
                            break;
                        case "file":
                            console.log("file process started");
                            if (metaData?.urls) result = await fileProcessor(collection._id, metaData.urls[0].url);
                            break;
                        default:
                            console.warn(`Unknown source type: ${source}`);
                            break;
                    }
                    await Collection.updateOne(
                        { _id: collection._id, "contents._id": _id },
                        {
                            $set: {
                                "contents.$.status": result.success ? "active" : "failed",
                                "contents.$.error": result.success ? null : result.error,
                                "contents.$.metaData.detailedReport": result.data,
                            }
                        }
                    );
                }
            }
        } catch (error) {
            console.error("Failed to sync collection:", error);
        }
    })(collection);
    return { statusCode: 200, message: "collection updated", data: collection }
});

// Delete Collection Route
export const deleteCollection = errorWrapper(async (req, res) => {
    // Find the collection by ID
    const collection = await Collection.findById(req.params.id);
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    // Ensure that the collection belongs to the user's business
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.collections.includes(req.params.id)) return { statusCode: 404, message: "You are not authorized to delete this collection", data: null }
    business.collections = business.collections.filter(id => id.toString() !== req.params.id);
    // Delete the collection
    await Promise.all([
        Collection.findByIdAndDelete(req.params.id),
        Data.deleteMany({ collection: req.params.id }),
        business.save()
    ])
    return { statusCode: 200, message: "Collection deleted successfully", data: null }
});
