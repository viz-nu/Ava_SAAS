import { model, Schema, Types } from 'mongoose';

const TicketSchema = new Schema(
    {
        business: { type: Types.ObjectId, ref: 'Businesses' },
        issueSummary: { type: String, required: true },
        channel: { type: String, enum: ['telegram', 'whatsapp', 'web', 'phone', 'instagram', 'sms', 'email'], required: true, },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', },
        status: { type: String, enum: ['pending', 'responded', 'resolved'], default: 'pending' },
        contactDetails: {
            email: { type: String },
            phone: { type: String },
            telegramId: { type: String },
            whatsappId: { type: String },
            instagramId: { type: String },
        },
        response: {
            channelId: { type: Schema.Types.ObjectId, ref: "Channel" },
            from: { type: String },
            to: { type: String },
            cc: { type: String },
            subject: { type: String },
            bcc: { type: String },
            text: { type: String },
            html: { type: String },
            updatedAt: { type: Date },
            sentAt: { type: Date },
            resolvedAt: { type: Date },
        },
    },
    { timestamps: true }
);
TicketSchema.methods.markSent = function (response) {
    this.status = 'responded';
    this.response = response;
    return this.save();
};
TicketSchema.methods.markResolved = function () {
    this.status = 'resolved';
    this.response.resolvedAt = new Date();
    return this.save();
};
export const Ticket = model('Ticket', TicketSchema, 'Ticket');
