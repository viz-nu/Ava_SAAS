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
    leads: [{ type: Schema.Types.ObjectId, ref: "Leads" }],
    execution: {
        nodes: [
            {
                identifier: { type: String, required: true },       // "send_whatsapp", "create_task","outbound_call","user_defined" etc.
                label: { type: String },                    // human-friendly name
                nodeType: { type: String },                     // "action" | "condition" | "delay" | "custom" etc.
                handler: { type: String, required: true },  // name of function in your code
                nodeConfig: { type: Schema.Types.Mixed },       // any params needed for that node
                isNodeActive: { type: Boolean, default: true },
                nodeOrder: { type: Number, default: 0 }         // optional: execution order
            }
        ],
        // Graph of transitions between nodes
        executionOrder: [{
            fromIndex: { type: Number, required: true },   // index in execution.nodes
            toIndex: { type: Number, required: true },   // index in execution.nodes
            // When should we follow this edge?
            condition: { type: String, enum: ["always", "on_true", "on_false", "on_success", "on_failure", "custom"], default: "always" },  // default path  // condition node evaluated to true  // condition node evaluated to false   // handler completed successfully // handler failed // use custom expression in conditionConfig
            conditionConfig: { type: Schema.Types.Mixed, default: null }, // Optional config for more complex rules (expressions, field matches, etc.)
            label: { type: String }// Optional: documentation or name for this transition
        }],
        executionStatus: [
            {
                lead: { type: Schema.Types.ObjectId, ref: "Leads", required: true },
                nodeStatuses: [
                    {
                        nodeIndex: { type: Number, required: true },
                        input: { type: Schema.Types.Mixed, default: null },
                        status: { type: String, enum: ["pending", "in-progress", "completed", "failed", "skipped"], default: "pending" },
                        logs: { type: String, default: "" },
                        output: { type: Schema.Types.Mixed, default: null },
                        error: { type: Schema.Types.Mixed, default: null },
                        updatedAt: { type: Date, default: Date.now }
                    }
                ]
            }
        ],
    },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    status: { type: String, enum: ["active", "paused", "completed"], default: "active" }
}, { timestamps: true });
export const Campaign = model('Campaign', CampaignSchema, 'Campaign');
