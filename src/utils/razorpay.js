import Razorpay from "razorpay";
import 'dotenv/config';
import { createHmac } from 'node:crypto';
export class razorpayProvider {
    constructor() {
        this.instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    }

    // create a new order
    async createOrder(amount, currency, receipt, notes) {
        const order = await this.instance.orders.create({
            amount: amount, // amount in paise
            currency: currency, // currency in INR
            receipt: receipt,
            notes: notes
        });
        return order;
    }
    async fetchOrder(id) {
        try {
            const order = await this.instance.orders.fetch(id);
            return order;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    async fetchAllOrders(limit, page) {
        try {
            const orders = await this.instance.orders.list({
                limit: limit,
                page: page
            });
            return orders;
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    async verifyPayment(order_id, payment_id, signature) {
        try {
            const body = order_id + "|" + payment_id;
            const expectedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest("hex");
            if (expectedSignature !== signature) throw new Error("Invalid signature");
            const order = await this.fetchOrder(order_id);
            return order.status === "paid"
        } catch (error) {
            console.error(error);
            return false;
        }
    }
    // subscribe to webhook
}