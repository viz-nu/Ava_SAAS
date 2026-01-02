// mongodb schema for all types of logs
import { model, Schema } from 'mongoose';
const LogSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    level: { type: String, enum: ['warn', 'error', 'info', 'debug'], required: true },
    event: { type: String, required: true },
    category: { type: String, required: true, enum: ['AUTHENTICATION', 'PAYMENT', 'CREDIT', 'SUBSCRIPTION', 'API_ACCESS', 'WEBHOOK', 'ERROR', 'OTHER',] },
    status: { type: String, enum: ['SUCCESS', 'FAILURE', 'PENDING'], default: 'SUCCESS', },
    message: String,
    service: { type: String, required: true }, // Identifies which microservice or backend component produced the log
    environment: { type: String, enum: ['dev', 'staging', 'prod'] },
    requestId: String,
    meta: Schema.Types.Mixed, // ipAddress, userAgent, etc.
    data: Schema.Types.Mixed,
}, {
    timestamps: true
});
// add index to the log schema
LogSchema.index({ user: 1, createdAt: -1 });
LogSchema.index({ event: 1, createdAt: -1 });
LogSchema.index({ category: 1, createdAt: -1 });
LogSchema.index({ status: 1, createdAt: -1 });
LogSchema.index({ service: 1, createdAt: -1 });
LogSchema.index({ environment: 1, createdAt: -1 });
LogSchema.index({ requestId: 1, createdAt: -1 });
export const Log = model('Log', LogSchema, 'Logs');