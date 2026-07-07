import { model, Schema } from 'mongoose';

const TriggerSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    name: String, // conversationStatusUpdated, leadStatusUpdated, 
    description: String,
    type: String, // [open, pending, snoozed, closed, archived, spam] || [new, contacted, qualified, converted, lost]
    workflows: [{ type: Schema.Types.ObjectId, ref: "Workflow" }],
}, {
    timestamps: true,
});

const Trigger = model('Trigger', TriggerSchema);

export default Trigger;