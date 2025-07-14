import { model, Schema } from 'mongoose';

const SubscriptionsSchema = new Schema({
    name: String,
    createdBy: { type: { type: Schema.Types.ObjectId, ref: 'Users' }, default: "" }
}, {
    timestamps: true
});
export const Subscriptions = model('Subscription', SubscriptionsSchema, "Subscriptions");