import { Schema, model } from 'mongoose';
const AmountSchema = new Schema({
    value: { type: Number, required: true }, // eg: 22000
    currency: { type: String, default: "INR" }
}, { _id: false });
const WebhookEventSchema = new Schema({
    event: String,
    payload: Schema.Types.Mixed,
    receivedAt: { type: Date, default: Date.now },
}, { _id: false });
const PaymentSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscriptions' },
    gateway: { type: String, enum: ['razorpay', 'stripe', 'paypal', 'bank_transfer', 'cash', 'other'], required: true },
    type: { type: String, enum: ['subscription', 'topup', 'one_time', 'other'], required: true },
    amount: AmountSchema,
    gatewayFee: AmountSchema,
    tax: AmountSchema,
    netAmount: AmountSchema,
    gatewayRefernce: Schema.Types.Mixed,
    webhookEvents: [WebhookEventSchema],
    metadata: {
        expiresAt: { type: Date, default: null },
        status: { type: String, enum: ["created", "pending", "authorized", "captured", "success", "failed", "refunded", "cancelled", "attempted"], default: 'created' },
        failureReason: String,
        retryCount: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    versionKey: false,
});
export const Payment = model('Payments', PaymentSchema, "Payments");