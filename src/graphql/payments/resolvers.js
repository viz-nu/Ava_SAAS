// crud operations for subscriptions
import { Subscription } from "../../models/Subscriptions.js";
import { Payment } from "../../models/Payments.js";
import graphqlFields from "graphql-fields";
import { flattenFields } from "../../utils/graphqlTools.js";
import { RazorPayService } from "../../services/razorPayService.js";
import { GraphQLError } from "graphql";
import { Business } from "../../models/Business.js";
export const ticketResolvers = {
    Query: {
        async fetchSubscriptions(_, { code, name, type, status = 'active', id }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = {};
            if (id) filter._id = id;
            if (code) filter.code = code;
            if (name) filter.name = name;
            if (status) filter.status = status;
            if (type) filter.type = type;
            const subscriptions = await Subscription.find(filter).sort({ createdAt: -1 }).select(projection).populate({ path: "allowedTopUps", select: projection });
            return subscriptions;
        },
        async fetchPublicSubscriptions(_, { code, name, id, status = 'active', type }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = { public: true };
            if (id) filter._id = id;
            if (code) filter.code = code;
            if (name) filter.name = name;
            if (status) filter.status = status;
            if (type) filter.type = type;
            const subscriptions = await Subscription.find(filter).sort({ createdAt: -1 }).select(projection).populate({ path: "allowedTopUps", select: projection });
            return subscriptions;
        }
    },
    Mutation: {
        async createAVASubscription(_, { input }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const subscription = await Subscription.create(input);
            await Subscription.populate(subscription, { path: "allowedTopUps", select: projection });
            return subscription;
        },
        async updateAVASubscription(_, { id, input }, context, info) {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const subscription = await Subscription.findByIdAndUpdate(id, input, { new: true }).select(projection).populate({ path: "allowedTopUps", select: projection });
            return subscription;
        },
        async deleteAVASubscription(_, { id }, context, info) {
            await Subscription.findByIdAndDelete(id);
            return true;
        },
        async startSubscription(_, { subscriptionId, gateway, paymentType = "subscription" }, context, info) {
            const [subscription, payment] = await Promise.all([
                Subscription.findById(subscriptionId).select('type amount validity credits spendRatio paymentGateway'),
                Payment.findOne({ business: context.user.business }).populate({ path: "subscription", select: { code: 1 } })
            ]);
            if (!subscription) throw new GraphQLError(400, "Subscription not found");
            if (subscription.type !== "BASE") throw new GraphQLError(400, "Subscription can only be created for BASE plan");
            if (!payment) throw new GraphQLError(400, "Payment not found, contact support");
            if (payment.subscription.code !== "FREE") throw new GraphQLError(400, "Subscription can only be created for FREE plan");

            payment.subscription = subscription;
            payment.type = paymentType;
            payment.gateway = gateway;
            payment.amount = subscription.amount;
            payment.metadata = {
                expiresAt: new Date(Date.now() + subscription.validity * 24 * 60 * 60 * 1000),
                status: "created"
            };

            let gatewayRefernce;
            switch (gateway) {
                case "razorpay":
                    let razorPayPlanId = subscription.paymentGateway.razorpay.plan_id;
                    gatewayRefernce = await RazorPayService.createSubscription({ plan_id: razorPayPlanId, total_count: 12, quantity: 1, notes: { subscriptionId: subscriptionId, businessId: context.user.business, paymentId: payment._id } });
                    break;
                default:
                    throw new GraphQLError(400, "Invalid gateway");
            }
            payment.gatewayRefernce = gatewayRefernce;
            await payment.save();
            return payment;
        },

    },
};