import axios from "axios";
import Queue from "bull";
import { digest } from './setup.js';
import { io } from './io.js';
import { Collection } from '../models/Collection.js';
export const urlProcessingQueue = new Queue('url-processing', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
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
                "timeout": 30000,
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
            const topics = await digest(data.data.markdown, url, collectionId, data.data.metadata, [], contentType = "markdown");
            await Collection.updateOne(
                { _id: collectionId, "contents._id": _id },
                { $push: { "contents.$.metaData.detailedReport": { success: true, url: url } }, $addToSet: { topics: topics } }
            );
        }
        return { success: true };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error data:', error.response?.data);
        } else {
            console.error('Unexpected error:', error);
        }
        await Collection.updateOne(
            { _id: collectionId, "contents._id": _id },
            { $push: { "contents.$.metaData.detailedReport": { success: false, url: url, error: error?.message } } }
        );
        throw error; // Re-throw so Bull knows this job failed
    }
});
// Handle completed jobs
urlProcessingQueue.on('completed', async (job, result) => {
    const { url, collectionId, receivers, _id } = job.data;
    console.log(`Job ${job.id} completed for URL: ${url} (Collection: ${collectionId})`);
    const [allCompletedJobs, allWaitingJobs, allActiveJobs, allFailedJobs] = await Promise.all([job.queue.getCompleted(), job.queue.getWaiting(), job.queue.getActive(), job.queue.getFailed()])
    const [completedJobs, waitingJobs, activeJobs, failedJobs] = await Promise.all([Promise.resolve(allCompletedJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allWaitingJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allActiveJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allFailedJobs.filter(j => j.data.collectionId === collectionId).length)]);
    const totalJobs = completedJobs + waitingJobs + activeJobs + failedJobs;
    const progressData = { total: totalJobs, progress: completedJobs + failedJobs, collectionId };
    if (receivers && receivers.length) receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: progressData }); });
    if (waitingJobs == 0 && activeJobs == 0) {
        console.log(`All jobs completed for Collection ID: ${collectionId}`);
        await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $set: { "contents.$.status": completedJobs <= failedJobs ? "failed" : "active" } })
        receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "collection-status", data: { collectionId, status: "active" } }) });
    }
});
// Handle failed jobs
urlProcessingQueue.on('failed', async (job, error) => {
    const { url, collectionId, receivers, _id } = job.data;
    console.error(`Job ${job.id} failed for URL: ${url}:`, error);
    const [allCompletedJobs, allWaitingJobs, allActiveJobs, allFailedJobs] = await Promise.all([job.queue.getCompleted(), job.queue.getWaiting(), job.queue.getActive(), job.queue.getFailed()])
    const [completedJobs, waitingJobs, activeJobs, failedJobs] = await Promise.all([Promise.resolve(allCompletedJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allWaitingJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allActiveJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allFailedJobs.filter(j => j.data.collectionId === collectionId).length)]);
    const totalJobs = completedJobs + waitingJobs + activeJobs + failedJobs;
    const progressData = { total: totalJobs, progress: completedJobs + failedJobs, collectionId };
    if (receivers && receivers.length) receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: progressData }); });
    if (waitingJobs == 0 && activeJobs == 0) {
        console.log(`All jobs completed for Collection ID: ${collectionId}`);
        await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $set: { "contents.$.status": completedJobs < failedJobs ? "failed" : "active", "contents.$.error": completedJobs <= failedJobs ? error : null } })
        receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "collection-status", data: { collectionId, status: completedJobs < failedJobs ? "failed" : "active" } }) });
    }
});
urlProcessingQueue.on('stalled', async (job) => {
    const { url, collectionId, receivers, _id } = job.data;
    console.error(`Job ${job.id} stalled for URL: ${url}`);
    const [allCompletedJobs, allWaitingJobs, allActiveJobs, allFailedJobs] = await Promise.all([job.queue.getCompleted(), job.queue.getWaiting(), job.queue.getActive(), job.queue.getFailed()])
    const [completedJobs, waitingJobs, activeJobs, failedJobs] = await Promise.all([Promise.resolve(allCompletedJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allWaitingJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allActiveJobs.filter(j => j.data.collectionId === collectionId).length), Promise.resolve(allFailedJobs.filter(j => j.data.collectionId === collectionId).length)]);
    const totalJobs = completedJobs + waitingJobs + activeJobs + failedJobs;
    const progressData = { total: totalJobs, progress: completedJobs + failedJobs, collectionId };
    if (receivers && receivers.length) receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "adding-collection", data: progressData }); });
    if (waitingJobs == 0 && activeJobs == 0) {
        console.log(`All jobs completed for Collection ID: ${collectionId}`);
        await Collection.updateOne({ _id: collectionId, "contents._id": _id }, { $set: { "contents.$.status": completedJobs < failedJobs ? "failed" : "active", "contents.$.error": "stalled" } })
        receivers.forEach(receiver => { io.to(receiver.toString()).emit("trigger", { action: "collection-status", data: { collectionId, status: completedJobs < failedJobs ? "failed" : "active" } }) });
    }
})
// await urlProcessingQueue.obliterate({ force: true });
// const activeJobs = await urlProcessingQueue.getActive();
// console.log('Currently processing jobs:', activeJobs.map(j => j.id));