import { Router } from "express";
export const firecrawlRouter = Router()
firecrawlRouter.post('/batch-scrape', async (req, res) => {
    try {
        console.log("Webhook received:", req.body);
        // {
        //     success: true,
        //     type: 'batch_scrape.page',"batch_scrape.completed",
        //     id: '455733a8-021a-4b66-86d0-ea0af0b8ccb8',
        //     data: [
        //       {
        //         markdown: 'this is all markdown',
        //         metadata: { requestId: '1,741,973,406,127' }
        //       }
        //     ],
        //     metadata: { requestId: '1,741,973,406,127' }
        //   }
        res.status(200).json({ msg: "Webhook received" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
