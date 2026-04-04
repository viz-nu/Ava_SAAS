import { GraphQLError } from "graphql";
import { ApiAuthenticators } from "../../models/apiAuthenticator.js";
import { Api, Providers } from "../../models/ExternalServiceProviders.js";
import OauthGoogle from "../../services/Oauth/google.js";
import OauthMicrosoft from "../../services/Oauth/microsoft.js";
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
        fetchApis: async (_, { providers, providerName, title, description, version, _id, page = 1, limit = 10 }, context) => {
            const filter = {};
            // 🛡️ Safe checks
            if (providers?.length) filter.provider = { $in: providers };
            if (title) filter.title = title;
            if (description) filter.description = description;
            if (version) filter.version = version;
            if (_id) filter._id = _id;
            const skip = (page - 1) * limit;
            // 🔥 If providerName is present → use aggregation
            if (providerName) {
                const pipeline = [{ $match: filter }, { $lookup: { from: 'Providers', localField: 'provider', foreignField: '_id', as: 'provider' } }, { $unwind: '$provider' }, { $match: { 'provider.name': providerName, ...filter } }, { $facet: { data: [{ $skip: skip }, { $limit: limit }], totalCount: [{ $count: 'count' }] } }];
                const result = await Api.aggregate(pipeline);
                const data = result[0]?.data || [];
                const totalDocuments = result[0]?.totalCount[0]?.count || 0;
                return { data, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
            }
            // ✅ Normal query (no aggregation)
            const [apis, totalDocuments] = await Promise.all([Api.find(filter).skip(skip).limit(limit), Api.countDocuments(filter)]);
            return { data: apis, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        },
        fetchApiAuthenticators: async (_, { provider, providerName, _id, page = 1, limit = 10 }, context) => {
            const filter = {};
            if (provider) filter.provider = provider;
            if (_id) filter._id = _id;
            const skip = (page - 1) * limit;
            if (providerName) {
                const pipeline = [{ $match: filter }, { $lookup: { from: 'Providers', localField: 'provider', foreignField: '_id', as: 'provider' } }, { $unwind: '$provider' }, { $match: { 'provider.name': providerName, ...filter } }, { $facet: { data: [{ $skip: skip }, { $limit: limit }], totalCount: [{ $count: 'count' }] } }];
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
        },
        createIntegrationAuthenticationUrl: async (_, { scopeCategory, provider }, context) => {
            switch (provider) {
                case "Microsoft Excel":
                    return OauthMicrosoft.getAuthUrl({ scopeCategory });
                case "Gmail":
                case "Google Drive":
                case "Google Forms":
                case "Google Sheets":
                case "Google Calendar":
                    return OauthGoogle.getAuthUrl({ scopeCategory });
                default:
                    throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            }

        },
        createApiAuthenticator: async (_, { providerId, code }, context) => {
            const provider = await Providers.findById(providerId);
            if (!provider) throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            if (!code) throw new GraphQLError("Code not found", { extensions: { code: 'INVALID_INPUT' } });
            let credentials, config, authType = "oauth2", scope, accountDetails, tokens;
            switch (provider.name) {
                case "Microsoft Excel":
                    {
                        const tokenRes = await OauthMicrosoft.getTokens(code);
                        if (!tokenRes.success) throw new GraphQLError(tokenRes.error.message, { extensions: { code: tokenRes.error.code } });
                        tokens = tokenRes.data;
                        scope = tokens.scope.split(' ');
                        credentials = { tokenId: tokens.id_token, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)), tokenType: tokens.token_type }
                        config = { clientId: process.env.AzureApplicationClientId, clientSecret: process.env.AzureClientSecretValue, redirectUri: process.env.AZURE_REDIRECT_URI }
                        const userInfoRes = await OauthMicrosoft.getUserInfo(tokens.access_token);
                        if (!userInfoRes.success) throw new GraphQLError(userInfoRes.error.message, { extensions: { code: userInfoRes.error.code } });
                        accountDetails = userInfoRes.data;
                        break;
                    }
                case "Gmail":
                case "Google Drive":
                case "Google Forms":
                case "Google Sheets":
                case "Google Calendar": {
                    const tokenRes = await OauthGoogle.getTokens(code);
                    if (!tokenRes.success) throw new GraphQLError(tokenRes.error.message, { extensions: { code: tokenRes.error.code } });
                    tokens = tokenRes.data;
                    credentials = { tokenId: tokens.id_token, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: new Date(Date.now() + (tokens.expires_in * 1000)), tokenType: tokens.token_type, refreshTokenExpiresAt: new Date(Date.now() + (tokens.refresh_token_expires_in * 1000)) }
                    scope = tokens.scope.split(' ')
                    config = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: process.env.GOOGLE_REDIRECT_URI }
                    const userInfoRes = await OauthGoogle.getUserInfo(tokens.access_token);
                    if (!userInfoRes.success) throw new GraphQLError(userInfoRes.error.message, { extensions: { code: userInfoRes.error.code } });
                    accountDetails = userInfoRes.data;
                    break;
                }
                default:
                    throw new GraphQLError("Provider not found", { extensions: { code: 'INVALID_INPUT' } });
            }
            const ApiAuthenticator = await ApiAuthenticators.create({ provider: providerId, authType: authType, credentials: credentials, config: config, accountDetails: accountDetails, scope: scope, createdBy: context.user._id, business: context.user.business });
            return ApiAuthenticator
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