import axios from "axios";

class FirecrawlService {
    constructor() {
        this.apiKey = process.env.FIRECRAWL_API_KEY;
    }
    async startBatchScrape(urls, options = { formats: ['markdown'] }, customMetadata = {}) {
        const { data } = await axios({
            method: 'POST',
            url: 'https://api.firecrawl.dev/v2/batch/scrape',
            headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
            data: JSON.stringify({
                urls: urls,
                webhook: { url: 'https://chat.avakado.ai/webhook/llamaparse', headers: { contentType: 'application/json' }, metadata: customMetadata },
                ...options
            })
        });
        return data;
        // const { maxConcurrency = null, ignoreInvalidURLs = true, formats = ['markdown'], onlyMainContent = true, includeTags = [], excludeTags = [], maxAge = 172800000, minAge = null, headers = {}, waitFor = 0, mobile = false, skipTlsVerification = true, timeout = 30000, parsers = { type: 'pdf', mode: "auto" }, actions = [{ type: 'wait', milliseconds: 20 }], location = { country: 'US', languages: ['en-US'] }, removeBase64Images = true, blockAds = true, proxy = 'auto', storeInCache = true, zeroDataRetention = false } = options;
        // const options = {
        //     method: 'POST',
        //     headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         urls: urls,
        //         webhook: { url: '<string>', headers: {}, metadata: {}, events: ['completed'] },
        //         maxConcurrency: maxConcurrency,
        //         ignoreInvalidURLs: ignoreInvalidURLs,
        //         formats: formats,
        //         onlyMainContent: onlyMainContent,
        //         includeTags: includeTags,
        //         excludeTags: excludeTags,
        //         maxAge: maxAge,
        //         minAge: minAge,
        //         headers: {}, // Headers to send with the request. Can be used to send cookies, user-agent, etc.
        //         waitFor: waitFor,
        //         mobile: mobile,
        //         skipTlsVerification: skipTlsVerification,
        //         timeout: timeout,
        //         parsers: parsers,
        //         actions: actions,
        //         location: location,
        //         removeBase64Images: removeBase64Images,
        //         blockAds: blockAds,
        //         proxy: proxy,
        //         storeInCache: storeInCache,
        //         zeroDataRetention: zeroDataRetention
        //     })
        // };
    }
    async getBatchScrapeStatus(id) {
        const { data } = await axios({ method: 'GET', url: `https://api.firecrawl.dev/v2/batch/scrape/${id}`, headers: { Authorization: `Bearer ${this.apiKey}` } });
        return data;
    }
    async cancelBatchScrape(id) {
        const { data } = await axios({ method: 'DELETE', url: `https://api.firecrawl.dev/v2/batch/scrape/${id}`, headers: { Authorization: `Bearer ${this.apiKey}` } });
        return data;
    }
    async getBatchScrapeErrors(id) {
        const { data } = await axios({ method: 'GET', url: `https://api.firecrawl.dev/v2/batch/scrape/${id}/errors`, headers: { Authorization: `Bearer ${this.apiKey}` } });
        return data;
    }
}
export const firecrawlService = new FirecrawlService();