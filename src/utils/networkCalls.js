const axios = require('axios');

/**
 * Creates a dynamic axios request based on the provided configuration
 * @param {Object} config - The configuration object containing accessType, configData, and workingData
 * @returns {Promise} - The axios response promise
 */
export const makeApiRequest = async (config) => {
    try {
        const { accessType, configData, workingData } = config;

        // Extract request components
        const {
            headers: headersConfig,
            body: bodyConfig,
            url: urlConfig,
            auth: authConfig,
            method
        } = workingData || {};

        // Initialize request configuration
        const axiosConfig = {
            method: method || 'GET',
            timeout: configData?.timeout || 30000,
        };

        // Set URL
        if (urlConfig) {
            axiosConfig.url = urlConfig.defaultValue || urlConfig.data || '';
        }

        // Process headers
        const headers = {};
        if (headersConfig) {
            // If headersConfig is an array
            if (Array.isArray(headersConfig)) {
                headersConfig.forEach(header => {
                    if (header.key && (header.defaultValue || header.data)) {
                        headers[header.key] = header.data || header.defaultValue;
                    }
                });
            }
            // If headersConfig is a single object
            else if (typeof headersConfig === 'object') {
                if (headersConfig.key && (headersConfig.defaultValue || headersConfig.data)) {
                    headers[headersConfig.key] = headersConfig.data || headersConfig.defaultValue;
                }
            }
        }
        axiosConfig.headers = headers;

        // Process authentication if Private access type
        if (accessType === 'Private' && authConfig) {
            // Handle authentication based on auth configuration
            // This could be Basic Auth, Bearer Token, etc.
            if (authConfig.type === 'basic') {
                axiosConfig.auth = {
                    username: authConfig.username || configData?.id || '',
                    password: authConfig.password || configData?.token || ''
                };
            } else if (authConfig.type === 'bearer') {
                axiosConfig.headers['Authorization'] = `Bearer ${configData?.token || ''}`;
            }
        }

        // Process request body
        if (['POST', 'PUT', 'PATCH'].includes(method) && bodyConfig) {
            const requestBody = processRequestBody(bodyConfig);
            axiosConfig.data = requestBody;
        }

        // Configure retry logic if specified in configData
        const maxRetries = configData?.retries || 0;
        const retryDelay = configData?.retryDelay || 1000;

        // Execute request with retry logic
        return executeWithRetry(axiosConfig, maxRetries, retryDelay);
    } catch (error) {
        console.error('Error configuring API request:', error.message);
        throw error;
    }
}

/**
 * Process request body recursively based on the schema
 * @param {Object} bodyConfig - The body configuration object or array
 * @returns {Object} - The processed request body
 */
export const populateStructure = (child, dataMap, parentPath = "") => {
    const result = []
    if (child.dataType == "object") child.childSchema.forEach(ele => result.push(...populateStructure(ele, data, parentPath + "/" + child.key)))
    else {
        if (child.userDefined) {
            const obj = { ...child, fieldPath: parentPath + "/" + child.key }
            const value = dataMap.get(child.label);
            if (value !== undefined) obj.data = value || null;
            result.push(obj)
        }
    }
    return result
}
function constructNestedObject(inputArray) {
    let result = {};
    inputArray.forEach(({ fieldPath, data }) => {
        const keys = fieldPath.split('/').filter(Boolean);
        let current = result;
        keys.forEach((key, index) => {
            if (index === keys.length - 1) {
                current[key] = data;
            } else {
                current[key] = current[key] || {};
                current = current[key];
            }
        });
    });
    return result;
} 
export const processRequestBody = (child, data) => {
    // If bodyConfig is not defined, return empty object
    if (!child) return {};

    // If bodyConfig is an array (multiple body parameters)
    if (Array.isArray(bodyConfig)) {
        const result = {};
        bodyConfig.forEach(item => {
            if (item.key) {
                if (item.dataType === 'object' && item.childSchema) {
                    // Process nested objects
                    result[item.key] = processRequestBody(item.childSchema);
                } else {
                    // Get value from data or defaultValue
                    result[item.key] = item.data || item.defaultValue || '';
                }
            }
        });
        return result;
    }
    // If bodyConfig has childSchema (nested object)
    else if (bodyConfig.childSchema) return processRequestBody(bodyConfig.childSchema);
    // If bodyConfig is a single parameter
    else if (bodyConfig.key) {
        const result = {};
        result[bodyConfig.key] = bodyConfig.data || bodyConfig.defaultValue || '';
        return result;
    }

    return {};
}

/**
 * Execute axios request with retry logic
 * @param {Object} axiosConfig - The axios request configuration
 * @param {Number} maxRetries - Maximum number of retries
 * @param {Number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise} - The axios response promise
 */
export const executeWithRetry = async (axiosConfig, maxRetries, retryDelay) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await axios(axiosConfig);
        } catch (error) {
            lastError = error;
            console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);

            // Don't wait on the last attempt
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }

    throw lastError;
}

// Example usage
async function example() {
    try {
        const apiConfig = {
            accessType: "Public",
            configData: {
                id: "api_user",
                token: "api_secret_token",
                timeout: 5000,
                retries: 3,
                retryDelay: 1000
            },
            workingData: {
                headers: {
                    label: "Content-Type",
                    key: "Content-Type",
                    type: "static",
                    defaultValue: "application/json",
                    dataType: "string",
                    required: true,
                    data: ""
                },
                body: {
                    label: "Body",
                    key: "body",
                    dataType: "object",
                    required: true,
                    type: "dynamic",
                    childSchema: [
                        {
                            key: "personalInfo",
                            type: "dynamic",
                            label: "Personal Information",
                            dataType: "object",
                            required: true,
                            childSchema: [
                                {
                                    key: "firstName",
                                    type: "dynamic",
                                    label: "First Name",
                                    dataType: "string",
                                    required: true,
                                    data: "John"
                                },
                                {
                                    key: "lastName",
                                    type: "dynamic",
                                    label: "Last Name",
                                    dataType: "string",
                                    required: true,
                                    data: "Doe"
                                }
                            ]
                        },
                        {
                            key: "mobileNumber",
                            type: "dynamic",
                            label: "Mobile Number",
                            dataType: "string",
                            required: true,
                            data: "1234567890"
                        },
                        {
                            key: "requirement",
                            type: "dynamic",
                            label: "Requirement",
                            dataType: "string",
                            required: true,
                            data: "Consultation"
                        },
                        {
                            key: "date",
                            type: "dynamic",
                            label: "Date",
                            dataType: "string",
                            required: true,
                            data: new Date().toISOString()
                        }
                    ]
                },
                url: {
                    label: "url",
                    key: "url",
                    type: "static",
                    defaultValue: "https://crm.com/api/appointment",
                    dataType: "string",
                    required: true,
                    data: ""
                },
                method: "POST"
            }
        };

        const response = await makeApiRequest(apiConfig);
        console.log('API request successful:', response.data);
    } catch (error) {
        console.error('API request failed:', error);
    }
}