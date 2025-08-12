import { Action } from "../../models/Action.js";
import graphqlFields from 'graphql-fields';
import { flattenFields } from '../../utils/graphqlTools.js';
import { AgentModel } from "../../models/Agent.js";

export const actionResolvers = {
    Query: {
        actions: async (_, { id, limit = 10, isPublic }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (id) filter._id = id;
            if (isPublic !== undefined) filter.isPublic = isPublic;
            return await Action.find(filter)
                .populate('business')
                .select(projection)
                .limit(limit)
                .sort({ createdAt: -1 });
        }
    },
    Mutation: {
        createAction: async (_, { action }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const newAction = await Action.create({ ...action, business: context.user.business })
                .populate('business')
                .select(projection);
            return newAction;
        },
        updateAction: async (_, { id, action }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const projection = flattenFields(requestedFields);
            const updatedAction = await Action.findByIdAndUpdate(id, action, { new: true })
                .populate('business')
                .select(projection);
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