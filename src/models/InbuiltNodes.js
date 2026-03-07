import { model, Schema } from 'mongoose';
const NodeSchema = new Schema(
    {
        type: { type: String, required: true, enum: ['trigger', 'task', 'conditional'] },
        core: {
            inputMapper: String,
            inputSchema: Schema.Types.Mixed,
            outputSchema: Schema.Types.Mixed,
            configSchema: Schema.Types.Mixed,
            handlerFunction: { type: String, required: true },
            errorFunction: { type: String }
        },
        meta: { label: String }
    },
    { timestamps: true }
);
export const NodeModel = model('Node', NodeSchema, 'Nodes');