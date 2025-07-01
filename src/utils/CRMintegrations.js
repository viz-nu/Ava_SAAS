import 'dotenv/config';
import axios from 'axios';
import { fetchToken, storeNewToken } from './redisTokens.js';
import FormData from 'form-data';
import { readFileSync, unlinkSync } from "fs";
import pathw from 'path';
export const refreshToken = async () => {
    try {
        const formData = new URLSearchParams();
        formData.append('client_id', process.env.CRM_CLIENT_ID);
        formData.append('client_secret', process.env.CRM_CLIENT_SECRET);
        formData.append('refresh_token', process.env.CRM_REFRESH_TOKEN);
        formData.append('grant_type', 'refresh_token');
        const response = await fetch("https://accounts.zoho.in/oauth/v2/token", {
            method: "POST",
            headers: {
                "Cookie": "6e73717622=94da0c17b67b4320ada519c299270f95; _zcsr_tmp=c7e03338-ce1e-42ab-b257-4c365f3831bd; iamcsr=c7e03338-ce1e-42ab-b257-4c365f3831bd",
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "*/*",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive"
            },
            body: formData.toString()
        });
        const { access_token } = await response.json();
        return access_token
    } catch (error) {
        console.error(error);
        return new Error(`error at crm refreshToken`)
    }
}

export const leadCreation = async (accessToken, crmData) => {
    try {
        const response = await fetch("https://www.zohoapis.in/crm/v6/Leads", {
            method: "POST",
            headers: {
                "Authorization": `Zoho-oauthtoken ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "data": [{ ...crmData }]
            })
        });
        const { data } = await response.json();
        return data
    } catch (error) {
        console.error(error);
        return new Error(`error at crm lead creation`)
    }
}



async function getZohoTokens(authorizationCode) {
    try {
        const clientId = process.env.CRM_CLIENT_ID;
        const clientSecret = process.env.CRM_CLIENT_SECRET;
        const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code: authorizationCode,
            },
        });


        const { access_token, refresh_token, expires_in } = response.data;
    } catch (error) {
        console.error('Error fetching tokens:', error.response ? error.response.data : error.message);
    }
}



export const regenerateToken = async () => {
    try {
        const clientId = process.env.CRM_CLIENT_ID;
        const clientSecret = process.env.CRM_CLIENT_SECRET;
        const refresh_token = process.env.CRM_REFRESH_TOKEN;
        const { data } = await axios.post('https://accounts.zoho.in/oauth/v2/token', null,
            {
                params: {
                    refresh_token: refresh_token,
                    client_secret: clientSecret,
                    grant_type: "refresh_token",
                    client_id: clientId
                }
            })
        console.log({ "regeneratedZohoToken": data });
        await storeNewToken("ZOHO_ACCESS_TOKEN", data.access_token)
        return data.access_token
    } catch (error) {
        console.error(error);
        return false;
    }
}

export const createFolder = async (name, parent_id) => {
    try {
        const existingToken = await fetchToken("ZOHO_ACCESS_TOKEN")
        const ZOHO_ACCESS_TOKEN = (existingToken && await validateAccessToken(existingToken)) ? existingToken : await regenerateToken()
        const { data } = await axios.post(
            `https://www.zohoapis.in/workdrive/api/v1/files`,
            {
                data: {
                    attributes: {
                        name: name, // Folder name
                        parent_id: parent_id
                    },
                    type: "files" // Required type field for folder creation
                }
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`, // Authentication header
                    'Content-Type': 'application/json' // Ensure correct content type for JSON body
                }
            }
        );
        return data.data;
    } catch (error) {
        console.error(error);
    }
}

// WorkDrive.users.READ
export const validateAccessToken = async (token) => {
    try {
        // Making a minimal API call to validate the token
        await axios.get('https://www.zohoapis.in/workdrive/api/v1/users/me', {
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`,
            },
        });
        return true; // Token is valid
    } catch (error) {
        console.error(error);
        return false;
    }
}

// WorkDrive.files.READ WorkDrive.files.CREATE 
export const uploadFileToWorkDrive = async ({ originalname, path, mimetype, fileIdentifier, folder_ID }) => {
    const fileExtension = pathw.extname(originalname);
    const filename = fileIdentifier ? `${fileIdentifier}${fileExtension}` : originalname;
    const fileData = readFileSync(path);
    const formData = new FormData();
    formData.append('content', fileData, { filename, contentType: mimetype });
    formData.append('parent_id', folder_ID);
    formData.append('override-name-exist', 'true');
    let uploadData
    try {
        const existingToken = await fetchToken("ZOHO_ACCESS_TOKEN");
        const isValidToken = await validateAccessToken(existingToken);
        const ZOHO_ACCESS_TOKEN = isValidToken ? existingToken : await regenerateToken();
        const response = await axios.post('https://www.zohoapis.in/workdrive/api/v1/upload', formData, { headers: { Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`, ...formData.getHeaders(), }, });
        const fileInfo = JSON.parse(response.data.data[0].attributes["File INFO"])
        switch (fileInfo.OPERATION) {
            case "UPDATE":
                uploadData = { new: false }
                break;
            case "UPLOAD":
                const resourceId = response.data.data[0].attributes.resource_id;
                const previewResponse = await axios.get(`https://www.zohoapis.in/workdrive/api/v1/files/${resourceId}/previewinfo`, { headers: { Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}` } });
                uploadData = {
                    new: true,
                    FileName: response.data.data[0].attributes.FileName,
                    resource_id: resourceId,
                    download_url: `https://www.zohoapis.in/v1/workdrive/download/${resourceId}`,
                    mimetype,
                    originalname,
                    preview_url: previewResponse.data.data.attributes.preview_url,
                }
                break;
        }
    } catch (error) {
        console.error(error.response?.data || error.message);
        return { success: false, message: 'Error uploading file to WorkDrive', data: error.response?.data || error.message };
    } finally {
        unlinkSync(path);
    }
    return { success: true, message: 'file uploaded to WorkDrive', data: uploadData };
};

export const deleteFileInWorkDrive = async (resource_id) => {
    try {
        // Fetch and validate Zoho access token
        const existingToken = await fetchToken("ZOHO_ACCESS_TOKEN");
        const isValidToken = await validateAccessToken(existingToken);
        const ZOHO_ACCESS_TOKEN = isValidToken ? existingToken : await regenerateToken();

        // Perform the PATCH request to delete the file
        const response = await axios.patch(
            `https://www.zohoapis.in/workdrive/api/v1/files/${resource_id}`,
            {
                data: {
                    attributes: { status: "51" },
                    type: "files"
                }
            },
            {
                headers: { Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}` }
            }
        );

        // Return a success response
        return {
            success: true,
            message: 'File deleted from WorkDrive successfully',
            data: response.data
        };

    } catch (error) {
        // Log and return error response
        console.error(error.response?.data || error.message);
        return {
            success: false,
            message: 'Error deleting file in WorkDrive',
            data: error.response?.data || error.message
        };
    }
};


