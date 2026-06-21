
import { Lead, LeadTemplate } from "../../models/Leads.js";
import graphqlFields from "graphql-fields";
import { getSelectFields } from "../../utils/graphqlTools.js";
import { GraphQLError } from "graphql";
import { buildDuplicateQuery, mergeContactDetails, findMatchedHandles } from "../../utils/leadDuplicateUtils.js";

export const leadResolvers = {
  Query: {
    fetchleadsTemplates: async (
      _,
      { limit = 10, page = 1, id, isActive, templateId: ID },
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
      const {
        templateId, name, contactDetails, lastInteractedAt, nextFollowUpAt,
        source, tags, leadScore, status, notes, data, mode
      } = LeadCreateInput;

      const businessId = context.user.business;

      // Step 1: check for duplicate
      const duplicateQuery = buildDuplicateQuery(contactDetails, businessId);
      const existingLead = duplicateQuery ? await Lead.findOne(duplicateQuery) : null;

      // Step 2: handle based on mode
      if (existingLead) {
        if (!mode || !['merge', 'new'].includes(mode)) {
          const matched = findMatchedHandles(contactDetails, existingLead);
          throw new GraphQLError(
            `A lead with matching contact detail(s) already exists (matched on: ${matched.join(', ')}). ` +
            `You must specify a 'mode': use "merge" to combine this data into the existing lead, ` +
            `or "new" to create a separate lead anyway.`,
            { extensions: { code: 'DUPLICATE_LEAD', existingLeadId: existingLead._id, matchedOn: matched } }
          );
        }

        if (mode === 'merge') {
          const mergedContactDetails = mergeContactDetails(
            existingLead.contactDetails?.toObject?.() || existingLead.contactDetails,
            contactDetails
          );

          return Lead.findByIdAndUpdate(
            existingLead._id,
            {
              $set: {
                contactDetails: mergedContactDetails,
                // Only overwrite scalar fields if incoming has a value
                ...(name && { name }),
                ...(source && { source }),
                ...(notes && { notes }),
                ...(leadScore != null && { leadScore }),
                ...(status && { status }),
                ...(lastInteractedAt && { lastInteractedAt }),
                ...(nextFollowUpAt && { nextFollowUpAt }),
                ...(data && { data: { ...existingLead.data, ...data } }),
              },
              $addToSet: { tags: { $each: tags || [] } },  // merge tags without dupes
            },
            { new: true }
          );
        }

        // mode === 'new': fall through to create
      }

      // No duplicate, or mode is 'new' — create fresh
      return Lead.create({
        template: templateId,
        contactDetails,
        lastInteractedAt,
        nextFollowUpAt,
        name, source, tags, leadScore,
        status: status || 'new',
        notes, data,
        business: businessId,
        createdBy: context.user._id,
      });
    },


    // ─── bulkCreateLeads ───────────────────────────────────────────────────────────

    bulkCreateLeads: async (_, { dataList }, context) => {
      const businessId = context.user.business;
      const created = [];
      const merged = [];
      const duplicatesRequiringMode = [];

      for (const input of dataList) {
        const {
          templateId, name, contactDetails, lastInteractedAt, nextFollowUpAt,
          source, tags, leadScore, status, notes, data, mode
        } = input;

        const duplicateQuery = buildDuplicateQuery(contactDetails, businessId);
        const existingLead = duplicateQuery ? await Lead.findOne(duplicateQuery) : null;

        if (existingLead) {
          if (!mode || !['merge', 'new'].includes(mode)) {
            // Don't throw — collect all conflicts and report at the end
            const matched = findMatchedHandles(contactDetails, existingLead);
            duplicatesRequiringMode.push({
              input,
              existingLeadId: existingLead._id,
              matchedOn: matched,
            });
            continue;
          }

          if (mode === 'merge') {
            const mergedContactDetails = mergeContactDetails(
              existingLead.contactDetails?.toObject?.() || existingLead.contactDetails,
              contactDetails
            );

            const updated = await Lead.findByIdAndUpdate(
              existingLead._id,
              {
                $set: {
                  contactDetails: mergedContactDetails,
                  ...(name && { name }),
                  ...(source && { source }),
                  ...(notes && { notes }),
                  ...(leadScore != null && { leadScore }),
                  ...(status && { status }),
                  ...(lastInteractedAt && { lastInteractedAt }),
                  ...(nextFollowUpAt && { nextFollowUpAt }),
                  ...(data && { data: { ...existingLead.data, ...data } }),
                },
                $addToSet: { tags: { $each: tags || [] } },
              },
              { new: true }
            );
            merged.push(updated);
            continue;
          }

          // mode === 'new': fall through to create
        }

        const newLead = await Lead.create({
          template: templateId,
          contactDetails,
          lastInteractedAt,
          nextFollowUpAt,
          name, source, tags, leadScore,
          status: status || 'new',
          notes, data,
          business: businessId,
          createdBy: context.user._id,
        });
        created.push(newLead);
      }

      return { created, merged, duplicatesRequiringMode };
    },

    updateLead: async (_, { id, LeadCreateInput }, context) => {
      const { name, contactDetails, createdBy, lastInteractedAt, nextFollowUpAt, source, tags, leadScore, status, notes, data } = LeadCreateInput;
      const updateData = {};
      // Only set fields that were explicitly provided — never default status to "new" on update
      if (name !== undefined) updateData.name = name;
      if (source !== undefined) updateData.source = source;
      if (contactDetails !== undefined) updateData.contactDetails = contactDetails;
      if (createdBy !== undefined) updateData.createdBy = createdBy;
      if (lastInteractedAt !== undefined) updateData.lastInteractedAt = lastInteractedAt;
      if (nextFollowUpAt !== undefined) updateData.nextFollowUpAt = nextFollowUpAt;
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
