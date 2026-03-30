import { Providers } from "../../models/ExternalServiceProviders.js";

export const serviceProvidersResolvers = {
    Query: {
        fetchProviders: async (_, { name, description, icon, color, _id, page = 1, limit = 10 }, context) => {
            const filter = {};
            if (name) filter.name = name;
            if (description) filter.description = description;
            if (icon) filter.icon = icon;
            if (color) filter.color = color;
            if (_id) filter._id = _id;
            const providers = await Providers.find(filter).skip((page - 1) * limit).limit(limit);
            const totalDocuments = await Providers.countDocuments(filter);
            return { data: providers, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        }
    },
    Mutation: {
        createProvider: async (_, { name, description, icon, color }, context) => {
            return await Providers.create({ name, description, icon, color, createdBy: context.user._id });
        },
        updateProvider: async (_, { id, name, description, icon, color }, context) => {
            const fieldsToUpdate = {};
            if (name) fieldsToUpdate.name = name;
            if (description) fieldsToUpdate.description = description;
            if (icon) fieldsToUpdate.icon = icon;
            if (color) fieldsToUpdate.color = color;
            return await Providers.findByIdAndUpdate(id, fieldsToUpdate, { new: true });
        },
        deleteProvider: async (_, { id }) => {
            return await Providers.findByIdAndDelete(id);
        }
    }
};