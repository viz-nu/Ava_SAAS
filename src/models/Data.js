import { model, Schema } from 'mongoose';

const DataSchema = new Schema({
    collection: { type: Schema.Types.ObjectId, ref: "Collection" },
    content: String,
    chunkNumber: Number,
    summary: String,
    embeddingVector: [Number],
    newTopics: [String],
    metadata: {
        tokensUsed: Number,
        chunkSize: Number, // length of content
        createdAt: { type: Date, default: Date.now },  // time of creation
        url: String,
        tokenUsage: {
            embeddingTokens: Number,
            embeddingModel: String,
            summarizationInputTokens: Number,
            summarizationOutputTokens: Number,
            summarizationTotalTokens: Number,
            summarizationModel: String
        }
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