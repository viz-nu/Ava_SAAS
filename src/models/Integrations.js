import { model, Schema } from 'mongoose';

const IntegrationSchema = new Schema({
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    tokenType: String,
    accessToken: String,
    refreshToken: String,
    apiDomainUrl: String,
    domain:String,
    expiresAt: { type: Date, required: true },
    type: String,
    name: String,
    description: String,
    icon: String,
    color: String,
    url: String,
    purpose: Schema.Types.Mixed,
    scope: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
}, {
    timestamps: true
});
export const Integration = model('Integration', IntegrationSchema, "Integration");