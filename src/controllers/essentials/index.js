import axios from "axios"
import { errorWrapper } from "../../middleware/errorWrapper.js"
import { fetchUrlsFromSitemap, FetchUsingDroxy, sitemapGenerator } from "../../utils/websiteHelpers.js"

export const OrgNameSuggestion = errorWrapper(async (req, res, next) => {
    const { query } = req.query
    const { data } = await axios.get(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${query}`, {
        "origin": "https://auth0.com",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    })
    return { statusCode: 200, message: "Organization name suggestions", data }
})
export const subURLSuggest = errorWrapper(async (req, res, next) => {
    let { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    url = decodeURIComponent(url);
    let { sitemapUrls, mainUrl } = await sitemapGenerator(url)
    let subLinks = [];
    let src = "";
    subLinks = (sitemapUrls && sitemapUrls.length > 0) ? await fetchUrlsFromSitemap(sitemapUrls) : []
    src = "basics"
    if (subLinks.length === 0) {
        const droxyResult = await FetchUsingDroxy(mainUrl || url);
        if (droxyResult.success) {
            subLinks = droxyResult.urls;
            src = "droxy";
        }
    }
    console.log(src);
    return { statusCode: 200, message: "Sub-URLs suggestions", data: { urls: subLinks, metadata: { size: subLinks.length } } };
})