// import { model, Schema } from 'mongoose';
// const jobStatusEnum = ["scheduled", "active", "completed", "failed", "canceled", "delayed", "waiting"];
// const backoff = new Schema({
//     type: { type: String, enum: ["exponential", "fixed"], required: true },
//     delay_ms: { type: Number, required: true },
//     attempts: { max: Number, made: Number, reason: String },
// }, { _id: false })

// /* ───────────────────────────── Base Job ───────────────────────────── */
// const JobSchema = new Schema({
//     name: String,
//     description: String,
//     bullMQJobId: String, // bullmq job id    
//     idempotency_key: String,        // unique for dedup
//     tenant_id: String,
//     status: { type: String, enum: jobStatusEnum, default: 'waiting' },
//     priority: Number,               // 1 (highest) .. 10 (lowest)
//     schedule: {
//         type: { type: String, enum: ["once", "cron"], default: "once" },
//         run_at: Date,                 // for one-off
//         cron: String,                 // for recurring
//         timezone: String,
//         backoff: { type: backoff, default: undefined },
//         cancel_requested: { type: Boolean, default: false },
//     },
//     jobType: { type: String, enum: ["outboundCall"], default: "outboundCall" },
//     result_ref: Schema.Types.Mixed,
//     error_ref: Schema.Types.Mixed,
//     log: Schema.Types.Mixed,
//     tags: [String],
//     createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
//     business: { type: Schema.Types.ObjectId, ref: 'Business' },
// }, { discriminatorKey: 'jobType', timestamps: true, });

// // channelId, to, agentId, PreContext 

// export const Job = model('Job', JobSchema, 'Job');
// const outboundCallPayload = new Schema({
//     channelId: { type: Schema.Types.ObjectId, ref: "Channel" },
//     agentId: { type: Schema.Types.ObjectId, ref: "Agent" },
//     to: String,
//     PreContext: String
// }, { _id: false })
// /* ───────────────────────────── Outbound Call Job ──────────────────────────── */
// Job.discriminator('outboundCall', new Schema({ payload: outboundCallPayload }, { timestamps: true, discriminatorKey: 'jobType' }));