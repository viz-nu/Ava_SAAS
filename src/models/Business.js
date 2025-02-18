import { model, Schema } from 'mongoose';

const BusinessSchema = new Schema({
    name: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    products:[{ type: Schema.Types.ObjectId, ref: 'Product'}],
    collections:[{ type: Schema.Types.ObjectId, ref: 'Collection'}]
},{
    timestamps: true
});
export const Business = model('Businesses', BusinessSchema, "Businesses");