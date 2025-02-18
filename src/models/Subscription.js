import { model, Schema } from 'mongoose';

const SubscriptionsSchema = new Schema({
    name: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
},{
    timestamps: true
});
export const Subscriptions = model('Subscription', SubscriptionsSchema,"Subscriptions");