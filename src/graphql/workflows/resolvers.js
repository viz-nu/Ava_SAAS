import { Workflow } from "../../models/Workflow.js";
import { validateLoops } from "../../utils/workflowHelpers.js";
import { GraphQLError } from "graphql";

export const workflowResolvers = {
    Query: {
        async fetchWorkflows(_, { id, limit = 10, page = 1 }, context, info) {
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            const workflows = await Workflow.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            const totalDocuments = await Workflow.countDocuments(filter);
            return { data: workflows, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        },
    },
    Mutation: {
        async createWorkflow(_, { name, nodes, connections }, context, info) {
            let WorkflowTemplate = { name, nodes, connections, business: context.user.business, createdBy: context.user._id }
            if (!name || !nodes || !connections) throw new GraphQLError("Name, nodes, and connections are required", { extensions: { code: "BAD_USER_INPUT" } });
            if (validateLoops(WorkflowTemplate)) throw new GraphQLError("Workflow contains a loop. Cycles are not allowed.", { extensions: { code: "BAD_USER_INPUT" } });
            const workflow = await Workflow.create(WorkflowTemplate);
            return workflow;
        },
        async updateWorkflow(_, { id, name, nodes, connections }, context, info) {
            let WorkflowTemplate = { name, nodes, connections, business: context.user.business, createdBy: context.user._id }
            if (!name || !nodes || !connections) throw new GraphQLError("Name, nodes, and connections are required", { extensions: { code: "BAD_USER_INPUT" } });
            if (validateLoops(WorkflowTemplate)) throw new GraphQLError("Workflow contains a loop. Cycles are not allowed.", { extensions: { code: "BAD_USER_INPUT" } });
            const workflow = await Workflow.findByIdAndUpdate(id, WorkflowTemplate, { new: true });
            return workflow;
        },
        async deleteWorkflow(_, { id }, context, info) {
            const workflow = await Workflow.findByIdAndDelete(id);
            if (!workflow) throw new GraphQLError("Workflow not found", { extensions: { code: "BAD_USER_INPUT" } });
            return true;
        }
    }
};