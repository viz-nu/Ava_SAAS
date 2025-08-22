import { Integration } from "../../models/Integrations.js";
import { ZohoCRMIntegration } from "../../utils/Zoho.js";

export const zohoResolvers = {
    // Query: {
    //     fetchZohoURL: async (_, { domain }) => {
    //         const zohoCRM = new ZohoCRMIntegration();
    //         const { url } = zohoCRM.generateAuthUrl(domain);
    //         return url;
    //         //  https://www.avakado.ai/integrations/zoho?state=null&code={secretCode}&location=in&accounts-server=https%3A%2F%2Faccounts.zoho.in&
    //     },
    //     getZohoModules: async (_, { id }, context, info) => {
    //         const integration = await Integration.findById(id);
    //         const zohoCRM = new ZohoCRMIntegration();
    //         if (!integration) return {};
    //         if (new Date(integration.expiresAt) < new Date() + 10000) {
    //             const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
    //             if (!success) return {};
    //             integration.accessToken = data.access_token;
    //             integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
    //             await integration.save();
    //         }
    //         const { success, data } = await zohoCRM.getAllModules(integration.accessToken, integration.domain);
    //         if (!success) return {};
    //         return data;
    //     },
    //     getZohoRecords: async (_, { id, module, options }, context, info) => {
    //         const integration = await Integration.findById(id);
    //         const zohoCRM = new ZohoCRMIntegration();
    //         if (!integration) return {};
    //         if (new Date(integration.expiresAt) < new Date() + 10000) {
    //             const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
    //             if (!success) return {};
    //             integration.accessToken = data.access_token;
    //             integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
    //             await integration.save();
    //         }
    //         const { success, data } = await zohoCRM.fetchRecords(module, integration.accessToken, integration.domain, options);
    //         if (!success) return {};
    //         return data;
    //     },
    //     searchZohoRecords: async (_, { id, module, criteria }, context, info) => {
    //         const integration = await Integration.findById(id);
    //         const zohoCRM = new ZohoCRMIntegration();
    //         if (!integration) return {};
    //         if (new Date(integration.expiresAt) < new Date() + 10000) {
    //             const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
    //             if (!success) return {};
    //             integration.accessToken = data.access_token;
    //             integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
    //             await integration.save();
    //         }
    //         const { success, data } = await zohoCRM.searchRecords(module, criteria, integration.accessToken, integration.domain);
    //         if (!success) return {};
    //         return data;
    //     }
    // },
    Mutation: {
        createZohoIntegration: async (_, { code, domain }, context, info) => {
            const zohoCRM = new ZohoCRMIntegration();
            const { success, data } = await zohoCRM.getTokens(code, domain);
            if (!success) return {};
            const integration = await Integration.create({
                business: context.user.business,
                metaData: {
                    name: 'Zoho CRM',
                    description: 'Zoho CRM',
                    icon: 'https://www.zoho.com/favicon.ico',
                    color: '#000000',
                    purpose: 'crm',
                    type: 'zoho'
                },
                secrets: {
                    tokenType: data.token_type,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                },
                config: {
                    apiDomainUrl: data.api_domain,
                    domain: domain,
                    scope: data.scope,
                    expiresAt: new Date(Date.now() + (data.expires_in * 1000))
                },
                isActive: true,
                createdBy: context.user._id
            });
            return integration
        },
        // createZohoModule: async (_, { id, module }, context, info) => {
        //     const integration = await Integration.findById(id);
        //     const zohoCRM = new ZohoCRMIntegration();
        //     if (!integration) return {};
        //     if (new Date(integration.expiresAt) < new Date() + 10000) {
        //         const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
        //         if (!success) return {};
        //         integration.accessToken = data.access_token;
        //         integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        //         await integration.save();
        //     }
        //     const { success, data } = await zohoCRM.createModule(module, integration.accessToken, integration.domain);
        //     if (!success) return {};
        //     return data;
        // },
        // createZohoRecords: async (_, { id, module, records }, context, info) => {
        //     const integration = await Integration.findById(id);
        //     const zohoCRM = new ZohoCRMIntegration();
        //     if (!integration) return {};
        //     if (new Date(integration.expiresAt) < new Date() + 10000) {
        //         const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
        //         if (!success) return {};
        //         integration.accessToken = data.access_token;
        //         integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        //         await integration.save();
        //     }
        //     const { success, data } = await zohoCRM.createRecords(module, records, integration.accessToken, integration.domain);
        //     if (!success) return {};
        //     return data;
        // },
        // updateZohoRecord: async (_, { id, module, recordId, record }, context, info) => {
        //     const integration = await Integration.findById(id);
        //     const zohoCRM = new ZohoCRMIntegration();
        //     if (!integration) return {};
        //     if (new Date(integration.expiresAt) < new Date() + 10000) {
        //         const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
        //         if (!success) return {};
        //         integration.accessToken = data.access_token;
        //         integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        //         await integration.save();
        //     }
        //     const { success, data } = await zohoCRM.updateRecord(module, recordId, record, integration.accessToken, integration.domain);
        //     if (!success) return {};
        //     return data;
        // },
        // deleteZohoRecord: async (_, { id, module, recordId }, context, info) => {
        //     const integration = await Integration.findById(id);
        //     const zohoCRM = new ZohoCRMIntegration();
        //     if (!integration) return {};
        //     if (new Date(integration.expiresAt) < new Date() + 10000) {
        //         const { success, data } = await zohoCRM.refreshToken(integration.refreshToken, integration.domain);
        //         if (!success) return {};
        //         integration.accessToken = data.access_token;
        //         integration.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
        //         await integration.save();
        //     }
        //     const { success, data } = await zohoCRM.deleteRecord(module, recordId, integration.accessToken, integration.domain);
        //     if (!success) return {};
        //     return data;
        // }
    }
}