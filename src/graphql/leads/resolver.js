
import { Lead, LeadTemplate } from "../../models/Leads.js";
import graphqlFields from "graphql-fields";
import { getSelectFields } from "../../utils/graphqlTools.js";
import { GraphQLError } from "graphql";

export const leadResolvers = {
  Query: {
    fetchleadsTemplates: async (
      _,
      { limit = 10, page = 1, id, isActive },
      context,
      info
    ) => {
      const filter = { business: context.user.business };
      if (id !== undefined) filter._id = id;
      if (isActive !== undefined) filter.isActive = isActive;

      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { rootFields } = getSelectFields(requestedFields.data);

      const [leadsTemplates, totalDocuments] = await Promise.all([
        LeadTemplate.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select(rootFields),
        LeadTemplate.countDocuments(filter),
      ]);

      return {
        data: leadsTemplates,
        metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments },
      };
    },

    fetchLeads: async (
      _,
      { limit = 10, page = 1, templateId, id, status, origin, tags = [] },
      context,
      info
    ) => {
      const filter = { business: context.user.business };
      if (id !== undefined) filter._id = id;
      if (templateId !== undefined) filter.template = templateId;
      if (status !== undefined) filter.status = status;
      if (origin !== undefined) filter.source = origin;
      if (tags.length > 0) filter.tags = { $in: tags };

      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { rootFields } = getSelectFields(requestedFields.data);

      const [leads, totalDocuments] = await Promise.all([
        Lead.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select(rootFields),
        Lead.countDocuments(filter),
      ]);

      return {
        data: leads,
        metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments },
      };
    },
  },

  Mutation: {
    createLeadTemplate: async (_, { LeadTemplateInput }, context) => {
      const { name, description, fields, isActive } = LeadTemplateInput;
      if (!name)
        throw new GraphQLError("Name is required", { extensions: { code: "BAD_USER_INPUT" } });
      if (await LeadTemplate.findOne({ name, business: context.user.business }))
        throw new GraphQLError("Template name already exists", { extensions: { code: "BAD_USER_INPUT" } });

      return LeadTemplate.create({
        name, description, fields,
        isActive: isActive !== undefined ? isActive : true,
        business: context.user.business,
        createdBy: context.user._id,
      });
    },

    updateLeadTemplate: async (_, { id, LeadTemplateInput }, context) => {
      const { name, description, fields, isActive } = LeadTemplateInput;
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (fields !== undefined) updateData.fields = fields;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updated = await LeadTemplate.findOneAndUpdate(
        { _id: id, business: context.user.business },
        updateData,
        { new: true, runValidators: true }
      );
      if (!updated)
        throw new GraphQLError("Template not found", { extensions: { code: "NOT_FOUND" } });
      return updated;
    },

    deleteLeadTemplate: async (_, { id }, context) => {
      const deleted = await LeadTemplate.findOneAndDelete({
        _id: id,
        business: context.user.business,
      });
      if (!deleted)
        throw new GraphQLError("Template not found", { extensions: { code: "NOT_FOUND" } });
      return true;
    },

    createLead: async (_, { LeadCreateInput }, context) => {
      const { templateId, name, source, tags, leadScore, status, notes, data } = LeadCreateInput;
      return Lead.create({
        template: templateId,
        name, source, tags, leadScore,
        status: status || "new",
        notes, data,
        business: context.user.business,
        createdBy: context.user._id,
      });
    },

    bulkCreateLeads: async (_, { dataList }, context) => {
      const docs = dataList.map(({ templateId, name, source, tags, notes, data }) => ({
        template: templateId,
        name, source, tags, notes, data,
        status: "new",
        business: context.user.business,
        createdBy: context.user._id,
      }));
      return Lead.insertMany(docs);
    },

    updateLead: async (_, { id, LeadCreateInput }, context) => {
      const { name, source, tags, leadScore, status, notes, data } = LeadCreateInput;
      const updateData = {};
      // Only set fields that were explicitly provided — never default status to "new" on update
      if (name !== undefined) updateData.name = name;
      if (source !== undefined) updateData.source = source;
      if (tags !== undefined) updateData.tags = tags;
      if (leadScore !== undefined) updateData.leadScore = leadScore;
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (data !== undefined) updateData.data = data;

      const updated = await Lead.findOneAndUpdate(
        { _id: id, business: context.user.business },
        updateData,
        { new: true, runValidators: true }
      );
      if (!updated)
        throw new GraphQLError("Lead not found", { extensions: { code: "NOT_FOUND" } });
      return updated;
    },

    deleteLead: async (_, { id }, context) => {
      const deleted = await Lead.findOneAndDelete({
        _id: id,
        business: context.user.business,
      });
      if (!deleted)
        throw new GraphQLError("Lead not found", { extensions: { code: "NOT_FOUND" } });
      return true;
    },
  },
};
