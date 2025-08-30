import { Action } from "../../models/Action.js";
import graphqlFields from 'graphql-fields';
import { flattenFields } from '../../utils/graphqlTools.js';
import { AgentModel } from "../../models/Agent.js";
import { Business } from "../../models/Business.js";

export const actionResolvers = {
    Query: {
        actions: async (_, { id, limit = 10, isPublic }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (id) filter._id = id;
            if (isPublic !== undefined) filter.isPublic = isPublic;
            const actions = await Action.find(filter)
                .select(projection)
                .limit(limit)
                .sort({ createdAt: -1 });
            await Business.populate(actions, { path: 'business', select: nested.business });
            return actions;
        }
    },
    Mutation: {
        createAction: async (_, { action }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const newAction = await Action.create({ ...action, business: context.user.business })
                .select(projection);
            await Business.populate(newAction, { path: 'business', select: nested.business });
            return newAction;
        },
        updateAction: async (_, { id, action }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const updatedAction = await Action.findByIdAndUpdate(id, action, { new: true })
                .select(projection);
            await Business.populate(updatedAction, { path: 'business', select: nested.business });
            return updatedAction;
        },
        deleteAction: async (_, { id }, context) => {
            await Promise.all([
                Action.findByIdAndDelete(id),
                AgentModel.updateMany({ actions: id, business: context.user.business }, { $pull: { actions: id } })
            ]);
            return true;
        }
    }
}