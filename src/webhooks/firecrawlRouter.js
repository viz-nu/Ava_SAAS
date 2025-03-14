import { Router } from "express";
export const firecrawlRouter = Router()
firecrawlRouter.post('/batch-scrape', async (req, res) => {
    try {
        console.log("Webhook received:", req.body);
        const { event, data } = req.body;
        switch (event) {
            case "batch_scrape.started":
                console.log("🟡 Scrape Started:", data);
                break;
            case "batch_scrape.page":
                console.log("🔵 Page Scraped:", data);
                break;
            case "batch_scrape.completed":
                console.log("✅ Scrape Completed:", data);
                break;
            case "batch_scrape.failed":
                console.log("❌ Scrape Failed:", data);
                break;
            default:
                console.log("⚠️ Unknown Event:", req.body);
        }
        // Always acknowledge the webhook
        res.status(200).json({ msg: "Webhook received" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
