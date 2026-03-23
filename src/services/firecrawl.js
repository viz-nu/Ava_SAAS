
import Firecrawl from '@mendable/firecrawl-js';

class firecrawlService {
    constructor() {
        this.client = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    }
    startBatchScrape(urls, options) {
        return this.client.startBatchScrape(urls, options);
    }
    async checkBatchScrapeStatus(id, getAllData = false, nextURL = null, skip = 0, limit = 10) {
        return this.client.checkBatchScrapeStatus(id, getAllData, nextURL, skip, limit);
    }
}
export const firecrawlService = new firecrawlService();