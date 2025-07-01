import { model, Schema } from 'mongoose';

const DataSchema = new Schema({
    collection: { type: Schema.Types.ObjectId, ref: "Collection" },
    content: { type: String },
    chunkNumber: { type: Number },
    summary: { type: String },
    embeddingVector: { type: [Number] },
    metadata: {
        tokensUsed: { type: Number },
        chunkSize: { type: Number }, // length of content
        createdAt: { type: Date, default: Date.now },  // time of creation
        url: { type: String }
    }
}, {
    timestamps: true,
    suppressReservedKeysWarning: true,
});
DataSchema.pre('save', function (next) {
    if (this.content) {
        this.metadata.chunkSize = this.content.length;
    }
    next();
});
export const Data = model('Data', DataSchema, "Data");