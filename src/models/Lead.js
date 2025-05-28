import { model, Schema } from 'mongoose';

const LeadSchema = new Schema({
    name: String,
    purpose: String,
    contactDetails: {
        email: String,
        phone: String
    },
}, {
    timestamps: true
});
export const Lead = model('Leads', LeadSchema, "Leads");