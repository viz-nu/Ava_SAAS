import { GraphQLError } from "graphql";
import { ApiAuthenticators } from "../../models/apiAuthenticator.js";
import { Api, Providers } from "../../models/ExternalServiceProviders.js";
import OauthGoogle from "../../services/Oauth/google.js";
import OauthMicrosoft from "../../services/Oauth/microsoft.js";
import OauthTwilio from "../../services/Oauth/twilio.js";
import OauthInstagram from "../../services/Oauth/instagram.js";
import OauthWhatsapp from "../../services/Oauth/whatsapp.js";
import OauthCalendly from "../../services/Oauth/calendly.js";
import graphqlFields from "graphql-fields";
import { getSelectFields } from "../../utils/graphqlTools.js";
const PROVIDER_MAP = {
    "Whatsapp": OauthWhatsapp,
    "Instagram": OauthInstagram,
    "Twilio": OauthTwilio,
    'Gmail': OauthGoogle,
    'Google Drive': OauthGoogle,
    'Google Forms': OauthGoogle,
    'Google Calendar': OauthGoogle,
    'Google Sheets': OauthGoogle,
    'Microsoft Excel': OauthMicrosoft,
    'Calendly': OauthCalendly
};
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
        },
        fetchApis: async (_, { providers, providerName, title, description, version, _id, page = 1, limit = 10 }, context, info) => {
            const filter = {};
            // 🛡️ Safe checks
            if (providers?.length) filter.provider = { $in: providers };
            if (title) filter.title = title;
            if (description) filter.description = description;
            if (version) filter.version = version;
            if (_id) filter._id = _id;
            const skip = (page - 1) * limit;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { rootFields, populateFields } = getSelectFields(requestedFields.data);
            // 🔥 If providerName is present → use aggregation
            if (providerName) {
                const projectFields = {};
                if (rootFields) {
                    rootFields.trim().split(' ').forEach(field => {
                        projectFields[field] = 1;
                    });
                }
                const pipeline = [
                    { $match: filter },
                    {
                        $lookup: {
                            from: 'Providers',
                            localField: 'provider',
                            foreignField: '_id',
                            as: 'provider'
                        }
                    },
                    { $unwind: '$provider' },
                    { $match: { 'provider.name': providerName } },
                    {
                        $facet: {
                            data: [
                                { $skip: skip },
                                { $limit: limit },
                                { $project: projectFields }
                            ],
                            totalCount: [{ $count: 'count' }]
                        }
                    }
                ];
                console.log("pipeline:", JSON.stringify(pipeline, null, 2));
                const result = await Api.aggregate(pipeline);
                const data = result[0]?.data || [];
                const totalDocuments = result[0]?.totalCount[0]?.count || 0;
                return { data, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
            }
            // ✅ Normal query (no aggregation)
            const [apis, totalDocuments] = await Promise.all([Api.find(filter).skip(skip).limit(limit).select(rootFields), Api.countDocuments(filter)]);
            if (populateFields?.provider) await Providers.populate(apis, { path: 'provider', select: populateFields.provider });
            return { data: apis, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        },
        fetchApiAuthenticators: async (_, { provider, providerName, _id, page = 1, limit = 10 }, context) => {
            const filter = {business: context.user.business};
            if (provider) filter.provider = provider;
            if (_id) filter._id = _id;
            const skip = (page - 1) * limit;
            if (providerName) {
                const pipeline = [{ $match: filter }, { $lookup: { from: 'Providers', localField: 'provider', foreignField: '_id', as: 'provider' } }, { $unwind: '$provider' }, { $match: { 'provider.name': providerName } }, { $facet: { data: [{ $skip: skip }, { $limit: limit }], totalCount: [{ $count: 'count' }] } }];
                const result = await Api.aggregate(pipeline);
                const data = result[0]?.data || [];
                const totalDocuments = result[0]?.totalCount[0]?.count || 0;
                return { data, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
            }
            const apiAuthenticators = await ApiAuthenticators.find(filter).skip(skip).limit(limit).populate('provider');
            const totalDocuments = await ApiAuthenticators.countDocuments(filter);
            return { data: apiAuthenticators, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        }
    },
    Mutation: {
        createProvider: async (_, { name, description, icon, color, basicScopes }, context) => {
            return await Providers.create({ name, description, icon, color, basicScopes, createdBy: context.user._id });
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
        },
        createAuthStrategy: async (_, { apiId, state = "" }, context) => {
            const api = await Api.findById(apiId).populate('provider');
            if (!api) throw new GraphQLError("Api not found", { extensions: { code: 'INVALID_INPUT' } });
            const oauthProvider = PROVIDER_MAP[api.provider.name];
            if (!oauthProvider) throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            const scopes = [...new Set([...api.provider.basicScopes, ...api.requiredScopes])];
            if (!scopes) throw new GraphQLError("Scopes not found", { extensions: { code: 'INVALID_INPUT' } });
            let authStrategy = {};
            switch (api.schemas.auth) {
                case 'oauth2':
                    authStrategy = { authType: api.schemas.auth, authUrl: oauthProvider.getAuthUrl({ state, scopes }), scopes: scopes, providerId: api.provider._id }
                    break;
                case 'basic':
                    const { ExpectedKeysFromQuery, AuthUrl } = oauthProvider.getAuthUrl({ state });
                    authStrategy = { authType: api.schemas.auth, authUrl: AuthUrl, scopes: [], providerId: api.provider._id, misc: { requiredKeysFromQuery: ExpectedKeysFromQuery } }
                    break;
                default:
                    throw new GraphQLError("Invalid auth type", { extensions: { code: 'INVALID_INPUT' } });
            }
            // console.log("authStrategy:", JSON.stringify(authStrategy, null, 2));
            return authStrategy;
        },
        createApiAuthenticator: async (_, { providerId, code, authType, existingAuthenticatorId = null, keys = {} }, context) => {
            const provider = await Providers.findById(providerId);
            if (!provider) throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            if (!code) throw new GraphQLError("Code not found", { extensions: { code: 'INVALID_INPUT' } });
            const oauthProvider = PROVIDER_MAP[provider.name];
            if (!oauthProvider) throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            if (code) keys.code = code;
            const { success, credentials, scope, accountDetails, config, tokenError = {} } = await oauthProvider.getTokens(keys);
            if (!success) throw new GraphQLError(tokenError.message, { extensions: { code: tokenError.code } });
            if (existingAuthenticatorId) {
                const update = { $set: { credentials, config, accountDetails } };
                if (scope?.length > 0) update.$addToSet = { scope: { $each: scope } };
                const existingAuthenticator = await ApiAuthenticators.findByIdAndUpdate(existingAuthenticatorId, update, { new: true, runValidators: true });
                if (!existingAuthenticator) throw new GraphQLError("Authenticator not found", { extensions: { code: 'INVALID_INPUT' } });
                return existingAuthenticator;
            }
            return await ApiAuthenticators.create({ provider: providerId, authType, credentials, config, accountDetails, scope, createdBy: context.user._id, business: context.user.business });
        },
        createApi: async (_, { providerId, title, description, version, schemas, requestTemplate, requiredScopes }, context) => {
            const provider = await Providers.findById(providerId);
            if (!provider) throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            const api = await Api.create({ provider: providerId, title: title, description: description, version: version, schemas: schemas, requestTemplate: requestTemplate, requiredScopes: requiredScopes });
            return api
        },
        updateApi: async (_, { id, title, description, version, schemas, requestTemplate, requiredScopes }, context) => {
            const api = await Api.findByIdAndUpdate(id, { title: title, description: description, version: version, schemas: schemas, requestTemplate: requestTemplate, requiredScopes: requiredScopes }, { new: true });
            return api
        },
        deleteApi: async (_, { id }) => {
            return await Api.findByIdAndDelete(id);
        }
    }
};