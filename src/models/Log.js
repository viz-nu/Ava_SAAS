// mongodb schema for all types of logs
import { model, Schema } from 'mongoose';
const LogSchema = new Schema({
    level: { type: String, enum: ['warn', 'error', 'info', 'debug'], required: true },
    message: String,
    service: { type: String, required: true }, // Identifies which microservice or backend component produced the log
    environment: { type: String, enum: ['dev', 'staging', 'prod'] },
    requestId: String,
    meta: Schema.Types.Mixed,
    data: Schema.Types.Mixed,
}, {
    timestamps: true
});
export const Log = model('Log', LogSchema, 'Logs');