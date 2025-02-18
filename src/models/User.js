import { model, Schema } from 'mongoose';

const UserSchema = new Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['admin', 'manager'], default: 'manager' },
    business: { type: Schema.Types.ObjectId, ref: 'Organization' },
    isVerified: { type: Boolean, default: false },
    emailToken: String,
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' }
}, {
    timestamps: true
});
export const User = model('Users', UserSchema, "Users");