import { model, Schema } from 'mongoose';
const content = new Schema({
    source: { type: String, enum: ['website', 'youtube', 'file'] },
    metaData: { type: Schema.Types.Mixed },
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