// package.json dependencies needed:
// npm install express axios dotenv crypto


import axios from 'axios';
// import crypto from 'crypto';
export class ZohoCRMIntegration {
    constructor() {
        // Zoho domains for different regions
        this.domains = {
            'com': 'https://accounts.zoho.com', // US
            'eu': 'https://accounts.zoho.eu',   // Europe
            'in': 'https://accounts.zoho.in',   // India
            'com_au': 'https://accounts.zoho.com.au', // Australia
            'jp': 'https://accounts.zoho.jp',   // Japan
            'ca': 'https://accounts.zoho.ca'    // Canada
        };

        this.apiDomains = {
            'com': 'https://www.zohoapis.com',
            'eu': 'https://www.zohoapis.eu',
            'in': 'https://www.zohoapis.in',
            'com_au': 'https://www.zohoapis.com.au',
            'jp': 'https://www.zohoapis.jp',
            'ca': 'https://www.zohoapis.ca'
        };

        this.clientId = process.env.ZOHO_AVAKADO_CLIENT_ID;
        this.clientSecret = process.env.ZOHO_AVAKADO_CLIENT_SECRET;
        this.redirectUri = process.env.ZOHO_AVAKADO_REDIRECT_URI;
        this.scope = 'ZohoCRM.modules.ALL ZohoCRM.settings.ALL WorkDrive.users.ALL WorkDrive.files.ALL';
    }

    // Step 1: Generate OAuth authorization URL
    generateAuthUrl(domain = 'com', state = null) {
        // if (!state) state = crypto.randomBytes(16).toString('hex');
        const params = new URLSearchParams({ response_type: 'code', client_id: this.clientId, scope: this.scope, redirect_uri: this.redirectUri, state: state, access_type: 'offline' });
        return { url: `${this.domains[domain]}/oauth/v2/auth?${params}` };
    }

    // Step 2: Exchange authorization code for tokens
    async getTokens(code, domain = 'com') {
        try {
            const response = await axios.post(`${this.domains[domain]}/oauth/v2/token`, {
                grant_type: 'authorization_code',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: this.redirectUri,
                code: code
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            if (response.data.error) return { success: false, error: response.data.error };

            return { success: true, data: response.data, url: `${this.apiDomains[domain]}/crm/v2/` };

        } catch (error) {
            console.error("Error in fetching tokens", error);
            return { success: false, error: error.response?.data || error.message };
        }
    }

    // Step 3: Refresh access token
    async refreshToken(refreshToken, domain = 'com') {
        try {
            const response = await axios.post(`${this.domains[domain]}/oauth/v2/token`, {
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    // Step 4: Make authenticated API requests
    async makeApiRequest(endpoint, method = 'GET', data = null, accessToken, domain = 'com') {
        try {
            const config = {
                method: method,
                url: `${this.apiDomains[domain]}/crm/v2/${endpoint}`,
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            };
            if (data) config.data = data;
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            const status = error.response?.status;
            const errorCode = error.response?.data?.code;
            // Other errors
            return { success: false, error: error.response?.data || error.message, status };
        }
    }


    // Fetch records from a module
    async fetchRecords(module, accessToken, domain = 'com', options = {}) {
        let endpoint = module;

        // Add query parameters if provided
        const params = new URLSearchParams();
        if (options.page) params.append('page', options.page);
        if (options.per_page) params.append('per_page', options.per_page);
        if (options.fields) params.append('fields', options.fields);
        if (options.sort_order) params.append('sort_order', options.sort_order);
        if (options.sort_by) params.append('sort_by', options.sort_by);

        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }

        return await this.makeApiRequest(endpoint, 'GET', null, accessToken, domain);
    }

    // Create a single record
    async createRecord(module, recordData, accessToken, domain = 'com') {
        const data = {
            data: [recordData],
            trigger: ['approval', 'workflow', 'blueprint']
        };

        return await this.makeApiRequest(module, 'POST', data, accessToken, domain);
    }

    // Create multiple records
    async createRecords(module, recordsData, accessToken, domain = 'com') {
        const data = {
            data: recordsData,
            trigger: ['approval', 'workflow', 'blueprint']
        };

        return await this.makeApiRequest(module, 'POST', data, accessToken, domain);
    }

    // Update a record
    async updateRecord(module, recordId, recordData, accessToken, domain = 'com') {
        const data = {
            data: [recordData],
            trigger: ['approval', 'workflow', 'blueprint']
        };

        return await this.makeApiRequest(`${module}/${recordId}`, 'PUT', data, accessToken, domain);
    }

    // Delete a record
    async deleteRecord(module, recordId, accessToken, domain = 'com') {
        return await this.makeApiRequest(`${module}/${recordId}`, 'DELETE', null, accessToken, domain);
    }

    // Get module metadata
    async getModuleMetadata(module, accessToken, domain = 'com') {
        return await this.makeApiRequest(`settings/modules/${module}`, 'GET', null, accessToken, domain);
    }

    // Get all modules
    async getAllModules(accessToken, domain = 'com') {
        return await this.makeApiRequest('settings/modules', 'GET', null, accessToken, domain);
    }
    // Get all modules
    async createModule(module, accessToken, domain = 'com') {
        return await this.makeApiRequest('settings/modules', 'POST', module, accessToken, domain);
    }

    // Search records
    async searchRecords(module, criteria, accessToken, domain = 'com') {
        const endpoint = `${module}/search?criteria=${encodeURIComponent(criteria)}`;
        return await this.makeApiRequest(endpoint, 'GET', null, accessToken, domain);
    }

    // Convert lead
    async convertLead(leadId, conversionData, accessToken, domain = 'com') {
        const data = {
            data: [conversionData]
        };
        return await this.makeApiRequest(`Leads/${leadId}/actions/convert`, 'POST', data, accessToken, domain);
    }
}
