import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { Collection } from "../../models/Collection.js";
import { collectionSchema, updateSchema } from "../../Schema/index.js";
// Create Collection
export const createCollection = errorWrapper(async (req, res) => {
    await collectionSchema.validate(req.body);
    const { name, contents } = req.body;
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const collection = new Collection({ name, contents });
    await collection.save();
    business.collections.push(collection._id);
    await business.save();
    return { statusCode: 201, message: "Registration successful", data: req.user }
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
    const { action, name, contents } = req.body;
    const collection = await Collection.findById(req.params.id);
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.collections.includes(req.params.id)) return { statusCode: 403, message: "You are not authorized to modify this collection", data: null }
    switch (action) {
        case 'rename':
            if (name) collection.name = name;
            break;
        case 'addContent':
            if (contents) {
                contents.forEach(newContent => {
                    collection.contents.push(newContent);
                });
            }
            break;
        case 'removeContent':
            if (contents) {
                contents.forEach(contentToRemove => {
                    collection.contents = collection.contents.filter(c => c.source !== contentToRemove.source);
                });
            }
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
    const collection = await Collection.findById(req.params.id);
    if (!collection) return { statusCode: 404, message: "Collection not found", data: null }

    // Ensure that the collection belongs to the user's business
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }

    if (!business.collections.includes(req.params.id)) return { statusCode: 404, message: "You are not authorized to delete this collection", data: null }

    // Delete the collection
    await Collection.findByIdAndDelete(req.params.id);

    // Remove the collection from the business's collection list
    business.collections = business.collections.filter(id => id.toString() !== req.params.id);
    await business.save();

    return { statusCode: 200, message: "Collection deleted successfully", data: null }
});
