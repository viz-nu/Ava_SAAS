import { model, Schema } from 'mongoose';

const ActionSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    intent: String,
    intentData: Object
}, {
    timestamps: true
});
export const Action = model('Action', ActionSchema, "Action");