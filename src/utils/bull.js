import axios from "axios";
import Queue from "bull";
import { digestMarkdown } from './setup.js';
import { io } from './io.js';
import { Collection } from '../models/Collection.js';
export const urlProcessingQueue = new Queue('url-processing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
    },
    settings: {
        maxStalledCount: 3 // Increase retries before failing
    }
});
urlProcessingQueue.process(async (job) => {
    const { url, collectionId, receivers, _id } = job.data;
    try {
        console.log("working on :" + url);
        const { data } = await axios.post("https://api.firecrawl.dev/v1/scrape",
            {
                "url": url,
                "formats": ["markdown"],
                "skipTlsVerification": false,
                "timeout": 10000,
                "location": { "country": "US", "languages": ["en-US"] },
                "removeBase64Images": true,
                "blockAds": true,
                "proxy": "basic"
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.FIREBASE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        if (data?.data?.markdown) {
            console.log("digesting");
            await digestMarkdown(data.data.markdown, url, collectionId, data.data.metadata);
            await Collection.updateOne(
                { _id: collectionId, "contents._id": _id },
                { $push: { "contents.$.metaData.detailedReport": { success: true, url: url } } }
            );
        }
        return { success: true };
    } catch (error) {
        console.error(error);
        await Collection.updateOne(
            { _id: collectionId, "contents._id": _id },
            { $push: { "contents.$.metaData.detailedReport": { success: false, url: url, error: error?.message } } }
        );
        throw error; // Re-throw so Bull knows this job failed
    }
});

// Handle completed jobs
urlProcessingQueue.on('completed', async (job) => {
    const { url, collectionId, receivers, _id } = job.data;
    console.log(`Job ${job.id} completed for URL: ${url} (Collection: ${collectionId})`);
    const allCompletedJobs = await job.queue.getCompleted();
    const allWaitingJobs = await job.queue.getWaiting();
    const allActiveJobs = await job.queue.getActive();
    const completedJobs = allCompletedJobs.filter(j => j.data.collectionId === collectionId).length;
    const waitingJobs = allWaitingJobs.filter(j => j.data.collectionId === collectionId).length;
    const activeJobs = allActiveJobs.filter(j => j.data.collectionId === collectionId).length;
    const totalJobs = completedJobs + waitingJobs + activeJobs;
    const progressData = { total: totalJobs, progress: completedJobs, collectionId };
    console.log(`Progress Update:`, progressData);
    if (receivers && receivers.length) {
        receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: progressData }); });
    }
    if (completedJobs === totalJobs) {
        console.log(`All jobs completed for Collection ID: ${collectionId}`);
        receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "collection-status", data: { collectionId, status: "active" } }) });
    }
    await Collection.updateOne(
        { _id: collectionId, "contents._id": _id },
        { $set: { "contents.$.status": result.success ? "active" : "failed", "contents.$.error": result.success ? null : result.error, } });
});

// Handle failed jobs
urlProcessingQueue.on('failed', (job, error) => {
    console.error(`Job ${job.id} failed for URL: ${job.data.url}:`, error);
});
// await urlProcessingQueue.obliterate({ force: true });
// const activeJobs = await urlProcessingQueue.getActive();
// console.log('Currently processing jobs:', activeJobs.map(j => j.id));