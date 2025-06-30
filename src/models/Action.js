import { model, Schema } from 'mongoose';
const ToolParameterSchema = new Schema({
    dataType: {
        type: String,
        enum: ["object", "string", "number", "boolean", "integer", "array", "null"],
        required: true
    },
    dataFormat: Schema.Types.Mixed,
    isRequired: { type: Boolean, required: true },
    key: { type: String, required: true },
    validation: String,
    description: String,
    properties: {
        type: Map,
        of: new Schema({
            type: String,
            description: String,
        }, { _id: false }),
        default: undefined
    },
    additionalProperties: Boolean,
    label: String,
}, { _id: false });
const ActionSchema = new Schema({
    name: String,
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    async: true,
    name: String,
    description: String,
    needsApproval: Boolean, // Knowledge fetching doesn't need approval
    parameters: ToolParameterSchema,
    functionString: String,
    errorFunction: String,
    UI: Schema.Types.Mixed
}, {
    timestamps: true
});
export const Action = model('Action', ActionSchema, "Action");