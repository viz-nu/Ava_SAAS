import { Job } from '../models/Job.js';
import 'dotenv/config'
import Queue from "bull";
import axios from "axios";
import { getRedisClient } from "./dbConnect.js";
export let jobProcessing = null;
const initializeJobProcessingQueue = async () => {
    if (jobProcessing) return jobProcessing;

    console.log('🔄 Initializing job processing queue...');
    const redisClient = {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME, // Redis 6+ ACL username
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DATABASE) || 0
    };
    jobProcessing = new Queue("job-processing", {
        redis: redisClient,
        settings: {
            maxStalledCount: 3
        }
    });
    jobProcessing.process(async (bullJob) => {
        try {
            const { jobId } = bullJob.data;
            const jobDoc = await Job.findById(jobId);
            if (!jobDoc) throw new Error(`Job ${jobId} not found in DB`);
            console.log(JSON.stringify(jobDoc, null, 2));
            let result;
            switch (jobDoc.jobType) {
                case "outboundCall":
                    try {
                        result = await runGraphQLQuery({
                            query: `
                        mutation Mutation($channelId: ID!, $to: String!, $agentId: ID!, $preContext: String!) {
          makeTwilioAIOutboundCall(channelId: $channelId, to: $to, agentId: $agentId, PreContext: $preContext) {
            sid
            to
            from
            status
            duration
            price
            priceUnit
            direction
            startTime
            endTime
            answeredBy
            forwardedFrom
            parentCallSid
            callerName
            groupSid
            queueTime
            trunkSid
          }
        }`,
                            variables: {
                                "channelId": jobDoc.payload.channel,
                                "to": jobDoc.payload.to,
                                "agentId": jobDoc.payload.agent,
                                "preContext": jobDoc.payload.PreContext
                            },
                            endpoint: `https://chatapi.campusroot.com/graphql/`,
                            token: jobDoc.payload.accessToken
                        });                        
                    } catch (error) {
                        console.error("error in outbound-call", error);
                    }
                    break;
                default:
                    break;
            }
            console.log(`✅ GraphQL result for job ${jobId}:`, JSON.stringify(result));
//             ✅ GraphQL result for job 68baeac00e45d8e1a2e5209a: undefined
// 🎉 Job 68baeac00e45d8e1a2e5209a completed with result: undefined
            await Job.findByIdAndUpdate(jobId, { status: "completed", result_ref: result });
            return result;
        } catch (error) {
            console.error("error in job processing", error);
        }

        // triggered job {
        //     "id": "68bae8f6a022ea6bd00982f1",
        //     "name": "__default__",
        //     "data": {
        //       "jobId": "68bae8f6a022ea6bd00982f1"
        //     },
        //     "opts": {
        //       "jobId": "68bae8f6a022ea6bd00982f1",
        //       "delay": 109898,
        //       "removeOnComplete": true,
        //       "removeOnFail": true,
        //       "removeOnStalled": true,
        //       "attempts": 1,
        //       "timestamp": 1757079798922
        //     },
        //     "progress": 0,
        //     "delay": 0,
        //     "timestamp": 1757079798922,
        //     "attemptsMade": 0,
        //     "stacktrace": [],
        //     "returnvalue": null,
        //     "debounceId": null,
        //     "finishedOn": null,
        //     "processedOn": 1757079908817
        //   }
    });

    // Set up event handlers
    jobProcessing.on("completed", async (job, result) => {
        console.log(`🎉 Job ${job.id} completed with result:`, result);
        await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "completed" });
        job.remove();
    });

    jobProcessing.on("failed", async (job, err) => {
        console.error(`❌ Job ${job.id} failed:`, err.message);
        await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "failed" });
        job.remove();
    });

    jobProcessing.on("stalled", async (job) => {
        console.warn(`⚠️ Job ${job.id} stalled, retrying...`);
        await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "stalled" });
        job.remove();
    });

    console.log('✅ Job processing queue initialized');
    return jobProcessing;
}
export const getJobProcessingQueue = async () => {
    return await initializeJobProcessingQueue();
};
initializeJobProcessingQueue().catch(console.error);

export const syncWithDB = async () => {
    try {
        const jobProcessing = await getJobProcessingQueue();
        const now = new Date();
        const sixHoursLater = new Date(now.getTime() + 7 * 60 * 60 * 1000);

        const jobs = await Job.find({
            "schedule.run_at": { $gte: now, $lte: sixHoursLater },
            "schedule.cancel_requested": false,
            bullMQJobId: { $exists: false },
        }).sort({ "schedule.run_at": 1 });

        console.log(`found jobs ${jobs.length}`);

        if (jobs.length === 0) {
            console.log('✅ No jobs to schedule');
            return;
        }

        console.log('🚀 Starting to schedule jobs...');

        for (const job of jobs) {
            try {
                console.log(`⏰ Scheduling job ${job._id} for ${job.schedule.run_at}`);
                await scheduleJob(job._id, job.schedule.run_at, jobProcessing);
                console.log(`✅ Successfully scheduled job ${job._id}`);
            } catch (error) {
                console.error(`❌ Failed to schedule job ${job._id}:`, error);
            }
        }

        console.log('🎉 Finished scheduling all jobs');
    } catch (error) {
        console.error('💥 Error in syncWithDB:', error);
        throw error;
    }
};

export const scheduleJob = async (jobId, scheduledTime, jobProcessing) => {
    try {
        console.log(`⏰ scheduleJob called with jobId: ${jobId}, scheduledTime: ${scheduledTime}`);
        const delay = Math.max(0, new Date(scheduledTime).getTime() - Date.now());

        console.log(`⏱️ Calculated delay: ${delay}ms`);
        const scheduledJob = await jobProcessing.add({ jobId }, { jobId, delay, removeOnComplete: true, removeOnFail: true, removeOnStalled: true, });
        console.log("job scheduled", {
            id: scheduledJob.id,
            timestamp: scheduledJob.timestamp,
            delay: scheduledJob.delay
        });
        await Job.findOneAndUpdate({ _id: jobId }, { bullMQJobId: scheduledJob.id });
        console.log(`💾 Updated job ${jobId} with bullMQJobId: ${scheduledJob.id}`);
        return scheduledJob;
    } catch (error) {
        console.error(`💥 Error in scheduleJob for jobId ${jobId}:`, error);
        throw error;
    }
};

// Update other functions to use initializeQueue
export const fetchJob = async (bullJobId, jobProcessing) => {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    return job;
};

export async function rescheduleJob(bullJobId, newTime, jobProcessing) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    const delay = Math.max(0, new Date(newTime).getTime() - Date.now());
    const rescheduledJob = await jobProcessing.add(
        job.data,
        {
            jobId: bullJobId,
            delay,
            attempts: 3,
            backoff: { type: "exponential", delay: 60000 },
            removeOnComplete: true,
            removeOnFail: true,
            removeOnStalled: true,
        }
    );
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "scheduled", bullMQJobId: rescheduledJob.id });
    return rescheduledJob;
}

export async function cancelJob(bullJobId, jobProcessing) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "canceled", "schedule.cancel_requested": true });
    return job;
}

export async function retryJob(bullJobId, jobProcessing) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "retry" });
    return job;
}

async function runGraphQLQuery({ query, variables, endpoint, token }) {
    try {
        const response = await axios.post(endpoint, { query, variables },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        console.log("GraphQL Response:", response.data.data);
        return response.data.data;
    } catch (error) {
        console.error("GraphQL Error:", error.response?.data || error.message);
        throw error;
    }
}