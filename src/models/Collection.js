import { model, Schema } from 'mongoose';

const CollectionSchema = new Schema({
    name: { type: String, required: true, },
    description: { type: String },
    topics: [String],
    business: { type: { type: Schema.Types.ObjectId, ref: 'Businesses' }, default: "" },
    createdBy: { type: { type: Schema.Types.ObjectId, ref: 'Users' }, default: "" },
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    contents: [{
        source: { type: String, enum: ['website', 'youtube', 'file'] },
        metaData: { type: Schema.Types.Mixed },
        status: { type: String, default: "loading", enum: ["active", "loading", "failed"] },
        error: { type: String }
    }],
}, {
    timestamps: true
});
export const Collection = model('Collection', CollectionSchema, "Collection");