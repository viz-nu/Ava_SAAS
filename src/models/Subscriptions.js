import { Schema, model } from 'mongoose';
const AmountSchema = new Schema({
    value: { type: Number, required: true }, // eg: 22000
    currency: { type: String, default: "INR" }
}, { _id: false });
const SubscriptionSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    plan: { type: Schema.Types.ObjectId, ref: 'Plans' },
    gateway: { type: String, enum: ['razorpay', 'stripe', 'paypal', 'bank_transfer', 'cash', 'other'], required: true },
    type: { type: String, enum: ['subscription', 'topup', 'one_time', 'other'], required: true },
    events: {
        authenticated: Date,
        activated: Date,
        charged: Date,
        completed: Date,
        updated: Date,
        pending: Date,
        halted: Date,
        cancelled: Date,
        paused: Date,
        resumed: Date
    },
    amount: AmountSchema,
    gatewayFee: AmountSchema,
    tax: AmountSchema,
    netAmount: AmountSchema,
    billing: {
        startAt: Date,
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        nextChargeAt: Date,
        totalCount: Number,
        paidCount: { type: Number, default: 0 },
        remainingCount: Number
    },
    gatewayReference: Schema.Types.Mixed,
    credits: {
        lastGrantedCycle: { type: Number, default: 0 },
        lastGrantedAt: { type: Date, default: null }
    },
    metadata: {
        expiresAt: { type: Date, default: null },
        cancelledAt: { type: Date, default: null },
        status: { type: String, enum: ['authenticated', 'activated', 'charged', 'completed', 'updated', 'pending', 'halted', 'cancelled', 'paused', 'resumed'], default: 'authenticated' },
        inActive: Boolean,
        failureReason: String,
        retryCount: { type: Number, default: 0 },
        cancelledReason: String,
    }
}, {
    timestamps: true,
    versionKey: false,
});
SubscriptionSchema.methods.isUpdatedForThisCycle = function (lastGrantedCycle) {
    return this.credits.lastGrantedCycle <= lastGrantedCycle;
}
SubscriptionSchema.methods.UpdateCredits = async function (lastGrantedCycle) {
    this.credits.lastGrantedCycle = lastGrantedCycle;
    this.credits.lastGrantedAt = new Date();
    await this.save();
    return this;
}
export const Subscription = model('Subscriptions', SubscriptionSchema, "Subscriptions");

