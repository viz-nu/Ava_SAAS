import Razorpay from "razorpay";
// import crypto from 'node:crypto';
import "dotenv/config";

export class RazorPayService {
    static client = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    static async createOrder({ amount, currency = "INR", receiptId, notes = {} }) {
        return await this.client.orders.create({ amount: Math.round(amount * 100), currency, receipt: receiptId, notes, });
    }

    //   static verifyPaymentSignature({ order_id, payment_id, signature }) {
    //     const body = `${order_id}|${payment_id}`;
    //     const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body).digest("hex");
    //     if (expectedSignature !== signature) throw new Error("Invalid Razorpay signature");
    //     return true;
    //   }

    static async fetchPayment(payment_id) {
        return await this.client.payments.fetch(payment_id);
    }

    static async fetchOrderById(order_id) {
        return await this.client.orders.fetch(order_id);
    }

    static async fetchOrders({ limit = 10, skip = 0 }) {
        return await this.client.orders.all({ count: limit, skip });
    }

    static async refundPayment(payment_id, amount = null) {
        return await this.client.payments.refund(payment_id, amount ? { amount: amount * 100 } : {});
    }
    static async createSubscription({ plan_id, total_count = 120, quantity = 1, notes = {}, addons = null, offer_id = null, startDate = new Date() }) {
        const subscription = await this.client.subscriptions.create({ total_count, plan_id, quantity, customer_notify: true, addons, offer_id, notes, start_at: new Date(startDate).setHours(0, 0, 0, 0).getTime() / 1000 });
        return subscription;
    }
    static async fetchSubscriptionById(subscription_id) {
        return await this.client.subscriptions.fetch(subscription_id);
    }
    static async fetchSubscriptions({ plan_id, from, to, limit = 10, skip = 0 }) {
        return await this.client.subscriptions.all({ plan_id, from: new Date(from).getTime() / 1000, to: new Date(to).getTime() / 1000, count: limit, skip });
    }
    static async updateSubscription(subscription_id, { plan_id, total_count = 12, quantity = 1, notes = {}, addons = null, offer_id = null }) {
        return await this.client.subscriptions.update(subscription_id, { plan_id, total_count, quantity, addons, offer_id, notes });
    }
    static async cancelSubscription(subscription_id) {
        return await this.client.subscriptions.cancel(subscription_id, { cancel_at_cycle_end: true, });
    }
    static async pauseSubscription(subscription_id) {
        return await this.client.subscriptions.pause(subscription_id, { pause_at: "now" });
    }
    static async resumeSubscription(subscription_id) {
        return await this.client.subscriptions.resume(subscription_id, { resume_at: "now" });
    }
    static async fetchSubscriptionInvoices(subscription_id) {
        return await this.client.invoices.all({ subscription_id });
    }
}
