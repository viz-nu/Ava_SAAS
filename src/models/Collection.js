import { model, Schema } from 'mongoose';

const CollectionSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    contents: [{
        source: { type: String, enum: ['website', 'youtubeVideo', 'file'] },
        metaData: { type: Schema.Types.Mixed },
        status: { type: String, default: "loading", enum: ["active", "loading", "failed"] }
    }],
}, {
    timestamps: true
});
export const Collection = model('Collection', CollectionSchema, "Collection");