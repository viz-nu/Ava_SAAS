import { Schema, model } from "mongoose";
const receiversSchema = new Schema({
    personalInfo: {
        name: String,
        contactDetails: {
            email: String,
            phone: String
        },
        miscInfo: Schema.Types.Mixed
    },
    job: { type: Schema.Types.ObjectId, ref: "Job" },
    preferredLanguage: String,
    instructions: String
}, { _id: false })
const CampaignSchema = new Schema({
    name: String,
    agent: { type: Schema.Types.ObjectId, ref: "Agent" },
    schedule: {
        startAt: Date,
        endAt: Date,
        timeZone: String,
    },
    communicationChannels: [{ type: Schema.Types.ObjectId, ref: "Channel" }],
    cps: Number,
    receivers: [receiversSchema],
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    status: { type: String, enum: ["active", "paused", "completed"], default: "active" }
}, { timestamps: true });
export const Campaign = model('Campaign', CampaignSchema, 'Campaign');
