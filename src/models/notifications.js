// mongodb schema for notificatiosn that contains the following fields => head, body,type,attachments, status timestamps
import { model, Schema, Types } from 'mongoose';
const NotificationSchema = new Schema(
    {
        business: { type: Types.ObjectId, ref: 'Businesses' },
        head: String,
        body: String,
        type: String,
        attachments: Schema.Types.Mixed,
        status: { type: String, default: "unseen" },
    },
    { timestamps: true }
);
export const Notification = model('Notification', NotificationSchema, 'Notification');