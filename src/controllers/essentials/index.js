import { URL } from 'url';
import psl from 'psl';
import axios from "axios"
import { errorWrapper } from "../../middleware/errorWrapper.js"
import { fetchUrlsFromSitemap, fetchUrlsUsingLangChain, FetchUsingDroxy, sitemapGenerator } from "../../utils/websiteHelpers.js"
import { Business } from "../../models/Business.js"
import Document from "../../models/Document.js"
import { uploadFileToWorkDrive } from "../../utils/CRMintegrations.js"
export const OrgNameSuggestion = errorWrapper(async (req, res, next) => {
    const { query } = req.query
    const { data } = await axios.get(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${query}`, {
        "origin": "https://auth0.com",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    })
    return { statusCode: 200, message: "Organization name suggestions", data }
})
export const subURLSuggest = errorWrapper(async (req, res, next) => {
    let { url } = req.query, subLinks = [], src = "LangChain";
    if (!url) return res.status(400).json({ error: 'Missing url' });
    url = decodeURIComponent(url);
    const urlObj = new URL(url);
    console.log("got url");
    const parsedDomain = psl.parse(urlObj.hostname);
    let baseUrl = parsedDomain.domain || urlObj.hostname;
    let mainUrl = `https://${baseUrl}`
    subLinks = await fetchUrlsUsingLangChain(mainUrl)
    subLinks.map(sublink => { return { url: sublink } })
    if (subLinks.length === 0) {
        let sitemapUrls = await sitemapGenerator(mainUrl)
        subLinks = (sitemapUrls && sitemapUrls.length > 0) ? await fetchUrlsFromSitemap(sitemapUrls) : []
        src = "basics"
    }
    if (subLinks.length === 0) {
        const droxyResult = await FetchUsingDroxy(mainUrl || url);
        if (droxyResult.success) {
            subLinks = droxyResult.urls;
            src = "droxy";
        }
    }
    return { statusCode: 200, message: "Sub-URLs suggestions", data: { urls: subLinks, metadata: { size: subLinks.length, src: src } } };
})

export const uploadFile = errorWrapper(async (req, res) => {
    try {
        const business = await Business.findById(req.user.business);
        if (!business) return { statusCode: 404, message: "Business not found", data: null }
        let folder_ID = business.docData.folder;
        const uploadResult = await Promise.all(
            req.files.map(async (file) => {
                const uploadedFileResponse = await uploadFileToWorkDrive({
                    originalname: file.originalname,
                    path: file.path,
                    mimetype: file.mimetype,
                    fileIdentifier: file.filename,
                    folder_ID: folder_ID
                });
                if (!uploadedFileResponse.success) return { statusCode: 500, message: "uploadedFileResponse.message", data: uploadedFileResponse }
                if (uploadedFileResponse.data.new) {
                    const { FileName, resource_id, mimetype, originalname, preview_url } = uploadedFileResponse.data;
                    const docDetails = {
                        data: {
                            FileName, resource_id, mimetype, originalname,
                            fileIdentifier: file.filename,
                            preview_url,
                            download_url: `https://files-accl.zohopublic.in/public/workdrive-public/download/${resource_id}`
                        },
                        user: req.user._id
                    };
                    const newDoc = await Document.create(docDetails);
                    return newDoc
                }
            })
        );
        return { statusCode: 200, message: "File uploaded successfully", data: uploadResult }
    } catch (err) {
        console.error(err);
        return { statusCode: 500, message: "File upload failed", data: err.message }
    }
});

//  https://files-accl.zohopublic.in/public/workdrive-public/download/wbmcxfc950c28b6d54a11b8d7fb4b0df77d83

// https://workdrive.zohopublic.in/public/api/v1/downloadauth/wbmcxf4f12ee475484d0fad0a107d58ae7345

// https://workdrive.zoho.in/file/wbmcxf4f12ee475484d0fad0a107d58ae7345

export const deleteFile = errorWrapper(async (req, res) => {

})