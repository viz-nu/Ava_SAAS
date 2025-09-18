import { model, Schema } from 'mongoose';
const metaData = new Schema({
    urls: [{ "url": String }],
    detailedReport: [{
        "success": Boolean,
        "url": String,
        "error": String,
        "attempted": { type: Boolean, default: false }
    }]
})
const content = new Schema({
    source: { type: String, enum: ['website', 'youtube', 'file'] },
    metaData: metaData,
    status: { type: String, default: "loading", enum: ["active", "loading", "failed"] },
    error: { type: String }
})
const CollectionSchema = new Schema({
    name: { type: String, required: true, },
    description: { type: String },
    topics: [String],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    contents: [content],
}, {
    timestamps: true
});
export const Collection = model('Collection', CollectionSchema, "Collection");