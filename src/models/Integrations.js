import { model, Schema } from 'mongoose';

const IntegrationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    metaData: {
        name: String,
        description: String,
        icon: String,
        color: String,
        purpose: Schema.Types.Mixed,
        type: { type: String, enum: ['zoho', 'twilio', 'exotel'], required: true },
    },
    secrets: {
        tokenType: String,
        accessToken: String,
        refreshToken: String,
        apiKey: String,
        apiToken: String,
    },
    config: {
        AccountSid: String,
        state: String,
        apiDomainUrl: String,
        domain: String,
        scope: String,
        expiresAt: Date,
        region:String
    },
    accountDetails: Schema.Types.Mixed,
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
}, {
    timestamps: true
});
export const Integration = model('Integration', IntegrationSchema, "Integration");