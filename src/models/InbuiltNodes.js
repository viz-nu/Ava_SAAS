import { model, Schema } from 'mongoose';

const InbuiltNodesSchema = new Schema({
    id: { type: String, required: true },
    ports: { input: Object, output: Object },
    core: {
        config: Object,
        handlerFunction: String,
        errorFunction: String,
        inputMapper: String,
    },
    meta: { label: String, type: String, templateType: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
});

export const InbuiltNodes = model('InbuiltNodes', InbuiltNodesSchema);