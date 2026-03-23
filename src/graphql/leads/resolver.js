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
    fetchLeads: async (_, { limit = 10, page = 1, templateId, id, status, creator, origin, tags = [] }, context, info) => {
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { projection, nested } = flattenFields(requestedFields);
      const filter = {};
      filter.business = context.user.business;
      if (id !== undefined) filter._id = id;
      if (templateId !== undefined) filter.template = templateId;
      if (status !== undefined) filter["data.status"] = status; // "NEW"  | "ATTEMPTED"  | "CONTACTED"  | "QUALIFIED"  | "INTERESTED"  | "NEGOTIATION"  | "CONVERTED"  | "LOST";
      if (creator !== undefined) filter["data.creator"] = creator; // "user" | "avakado" | "api" | "import" | "integration";
      if (origin !== undefined) filter["data.origin"] = origin; // "facebook_ads"  | "google_ads"  | "instagram_ads"  | "linkedin_ads"  | "website"  | "landing_page"  | "whatsapp"  | "email"  | "referral"  | "event"  | "walk_in"  | "cold_call"  | "partner"  | "marketplace"  | "other";
      if (tags.length > 0) filter["data.tags"] = { $in: tags };
      const leads = await Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
      const totalDocuments = await Lead.countDocuments(filter);
      return { data: leads, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
    },
    fetchLeadFacets: async (_, { templateId, status, creator, origin, tags = [] }, context) => {
      const match = { business: context.user.business };
      if (id) match._id = id;
      if (templateId) match.template = templateId;
      if (status) match["data.status"] = status;
      if (creator) match["data.creator"] = creator;
      if (origin) match["data.origin"] = origin;
      if (tags.length > 0) match["data.tags"] = { $in: tags };
      const facets = await Lead.aggregate([
        { $match: match },
        {
          $facet: {
            // 🔹 Status counts
            status: [
              {
                $group: {
                  _id: "$data.status",
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            // 🔹 Creator counts
            creator: [
              {
                $group: {
                  _id: "$data.creator",
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            // 🔹 Origin counts
            origin: [
              {
                $group: {
                  _id: "$data.origin",
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            // 🔹 Tags (array → unwind)
            tags: [
              { $unwind: "$data.tags" },
              {
                $group: {
                  _id: "$data.tags",
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ],

            // 🔹 Total count
            total: [
              {
                $count: "count",
              },
            ],
          },
        }]);
      return facets[0];
    }
  },
  Mutation: {
    createLeadTemplate: async (_, { LeadTemplateInput }, context, info) => {
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { projection, nested } = flattenFields(requestedFields);
      const { name, description, fields, isActive } = LeadTemplateInput;
      if (!name) throw new GraphQLError("Name is required", { extensions: { code: "BAD_USER_INPUT" } });
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
      // const { validatedData } = await validateLeadDataCore(templateId, data);

      // Use validated data instead of raw data
      const newLead = await Lead.create({ template: templateId, data: data, notes, business: context.user.business, createdBy: context.user._id });
      return newLead;
    },
    bulkCreateLeads: async (_, { dataList }, context, info) => {
      const requestedFields = graphqlFields(info, {}, { processArguments: false });
      const { projection, nested } = flattenFields(requestedFields);
      const validatedDataList = [];
      for (const { templateId, data, notes } of dataList) {
        // const { validatedData } = await validateLeadDataCore(templateId, data);
        validatedDataList.push({ template: templateId, data: data, notes, business: context.user.business, createdBy: context.user._id });
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
      // const { validatedData } = await validateLeadDataCore(lead.template, data);
      const updatedLead = await Lead.findByIdAndUpdate(id, { data: data, status: status || 'new', notes }, { new: true, runValidators: true });
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

