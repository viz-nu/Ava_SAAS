import { model, Schema } from 'mongoose';
const jobStatusEnum = ["scheduled", "active", "completed", "failed", "canceled", "delayed", "waiting", "stalled"];
const backoff = new Schema({
    type: { type: String, enum: ["exponential", "fixed"], required: true },
    delay_ms: { type: Number, required: true },
    attempts: { max: Number, made: Number, reason: String },
}, { _id: false })

const logEntry = new Schema({
    level: { type: String, enum: ["info", "warn", "error", "debug"], required: true },
    message: String,
    timestamp: { type: Date, default: Date.now },
    data: Schema.Types.Mixed
}, { _id: false });
/* ───────────────────────────── Base Job ───────────────────────────── */
const JobSchema = new Schema({
    name: String,
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign" },
    description: String,
    bullMQJobId: String, // bullmq job id    
    status: { type: String, enum: jobStatusEnum, default: 'waiting' },
    priority: Number,               // 1 (highest) .. 10 (lowest)
    schedule: {
        type: { type: String, enum: ["once", "cron"], default: "once" },
        run_at: Date,                 // for one-off
        cron: String,                 // for recurring
        timezone: String,
        backoff: { type: backoff, default: undefined },
        cancel_requested: { type: Boolean, default: false },
    },
    jobType: { type: String, enum: ["outboundCall"], default: "outboundCall" },
    result_ref: Schema.Types.Mixed,
    error_ref: Schema.Types.Mixed,
    log: [logEntry],
    tags: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
}, {
    discriminatorKey: 'jobType', timestamps: true, index: [
        { status: 1, 'schedule.run_at': 1 },
        { business: 1, status: 1 },
        { 'schedule.type': 1, 'schedule.run_at': 1 },
        { bullMQJobId: 1 }
    ]
});
// Pre-save middleware for validation
JobSchema.pre('save', function (next) {
    // Validate schedule based on type
    if (this.schedule.type === 'once' && !this.schedule.run_at) {
        return next(new Error('run_at is required for one-time jobs'));
    }

    if (this.schedule.type === 'cron' && !this.schedule.cron) {
        return next(new Error('cron expression is required for recurring jobs'));
    }

    // Validate priority
    if (this.priority < 1 || this.priority > 10) {
        return next(new Error('Priority must be between 1 and 10'));
    }

    next();
});

// Instance methods
JobSchema.methods.addLog = function (level, message, data = {}) {
    this.log.push({
        level,
        message,
        data,
        timestamp: new Date()
    });
    return this.save();
};
JobSchema.methods.markAsStarted = function () {
    this.status = 'active';
    this.lastExecutedAt = new Date();
    this.executionCount += 1;
    return this.save();
};

JobSchema.methods.markAsCompleted = function (result = null, duration = null) {
    this.status = 'completed';
    this.result_ref = result;
    if (duration) this.actualDuration = duration;
    return this.save();
};

JobSchema.methods.markAsFailed = function (error, duration = null) {
    this.status = 'failed';
    this.error_ref = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
    };
    if (duration) this.actualDuration = duration;
    return this.save();
};

// if schedule is updated then trigger sync

// channelId, to, agentId, PreContext 

export const Job = model('Job', JobSchema, 'Job');
const outboundCallPayload = new Schema({
    channel: { type: Schema.Types.ObjectId, ref: "Channel" },
    agent: { type: Schema.Types.ObjectId, ref: "Agent" },
    to: { type: String, required: true },
    accessToken: { type: String, required: true },
    PreContext: String,
    expectedDuration: Number,
    maxRetries: { type: Number, default: 3 },
    callbackUrl: String,
    cps: Number
}, { _id: false })
/* ───────────────────────────── Outbound Call Job ──────────────────────────── */
Job.discriminator('outboundCall', new Schema({ payload: outboundCallPayload }, { timestamps: true, discriminatorKey: 'jobType' }));