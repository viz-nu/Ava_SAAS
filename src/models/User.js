import { model, Schema } from 'mongoose';

const UserSchema = new Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['admin', 'manager', 'superAdmin'], default: 'admin' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
    isVerified: { type: Boolean, default: false },
    emailToken: String,
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    scopes: [String]
}, {
    timestamps: true
});
export const User = model('Users', UserSchema, "Users");