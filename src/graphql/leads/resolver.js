import { Lead, LeadTemplate } from "../../models/Leads.js";
import graphqlFields from "graphql-fields";
import { flattenFields } from "../../utils/graphqlTools.js";
import { GraphQLError } from "graphql";
import { validateLeadDataCore } from "../../middleware/validations.js";
export const leadResolvers = {
    Query: {
        fetchleadsTemplates: async (_, { limit = 10, page = 1, templateId, id, isActive }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (id !== undefined) filter._id = id;
            if (templateId !== undefined) filter.template = templateId;
            if (isActive !== undefined) filter.isActive = isActive;
            const leadsTemplates = await LeadTemplate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            return leadsTemplates;
        },
        fetchLeads: async (_, { limit = 10, page = 1, templateId, id, status }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const filter = {};
            filter.business = context.user.business;
            if (id !== undefined) filter._id = id;
            if (templateId !== undefined) filter.template = templateId;
            if (status !== undefined) filter.status = status;
            const leads = await Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            return leads;
        }
    },
    Mutation: {
        createLeadTemplate: async (_, { LeadTemplateInput }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const { name, description, fields, isActive } = LeadTemplateInput;
            if (!name || !fields || !Array.isArray(fields) || fields.length === 0) throw new GraphQLError("Name and fields array (with at least one field) are required", { extensions: { code: "BAD_USER_INPUT" } });
            for (const field of fields) if (!field.name || !field.type || !field.label) throw new GraphQLError("Each field must have name, type, and label", { extensions: { code: "BAD_USER_INPUT" } });
            if (await LeadTemplate.findOne({ name, business: context.user.business })) throw new GraphQLError("Template name already exists", { extensions: { code: "BAD_USER_INPUT" } });
            const newLeadTemplate = await LeadTemplate.create({ name, description, fields, isActive: isActive !== undefined ? isActive : true, business: context.user.business, createdBy: context.user._id });
            return newLeadTemplate;
        },
        updateLeadTemplate: async (_, { id, LeadTemplateInput }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const { name, description, fields, isActive } = LeadTemplateInput;
            const updateData = {};
            if (name !== undefined) updateData.name = name;
            if (description !== undefined) updateData.description = description;
            if (fields !== undefined) {
                if (!Array.isArray(fields) || fields.length === 0) throw new GraphQLError("Fields must be a non-empty array", { extensions: { code: "BAD_USER_INPUT" } });
                updateData.fields = fields;
            }
            if (isActive !== undefined) updateData.isActive = isActive;
            const updatedLeadTemplate = await LeadTemplate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
            if (!updatedLeadTemplate) throw new GraphQLError("Template not found", { extensions: { code: "BAD_USER_INPUT" } });
            return updatedLeadTemplate;
        },
        deleteLeadTemplate: async (_, { id }) => {
            const deletedLeadTemplate = await LeadTemplate.findByIdAndDelete(id);
            if (!deletedLeadTemplate) throw new GraphQLError("Template not found", { extensions: { code: "BAD_USER_INPUT" } });
            return true;
        },
        createLead: async (_, { LeadCreateInput }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const { templateId, data, status, notes } = LeadCreateInput;
            const { validatedData } = await validateLeadDataCore(templateId, data);

            // Use validated data instead of raw data
            const newLead = await Lead.create({ template: templateId, data: validatedData, status: status || 'new', notes, business: context.user.business, createdBy: context.user._id });
            return newLead;
        },
        bulkCreateLeads: async (_, { dataList }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const validatedDataList = [];
            for (const { templateId, data, status, notes } of dataList) {
                const { validatedData } = await validateLeadDataCore(templateId, data);
                validatedDataList.push({ template: templateId, data: validatedData, status: status || 'new', notes, business: context.user.business, createdBy: context.user._id });
            }
            const newLeads = await Lead.insertMany(validatedDataList);
            return newLeads;
        },
        updateLead: async (_, { id, LeadCreateInput }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const lead = await Lead.findById(id);
            if (!lead) throw new GraphQLError("Lead not found", { extensions: { code: "BAD_USER_INPUT" } });
            const { data, status, notes } = LeadCreateInput;
            const { validatedData } = await validateLeadDataCore(lead.template, data);
            const updatedLead = await Lead.findByIdAndUpdate(id, { data: validatedData, status: status || 'new', notes }, { new: true, runValidators: true });
            if (!updatedLead) throw new GraphQLError("Lead not found", { extensions: { code: "BAD_USER_INPUT" } });
            return updatedLead;
        },
        deleteLead: async (_, { id }) => {
            const deletedLead = await Lead.findByIdAndDelete(id);
            if (!deletedLead) throw new GraphQLError("Lead not found", { extensions: { code: "BAD_USER_INPUT" } });
            return true;
        }
    }
};

