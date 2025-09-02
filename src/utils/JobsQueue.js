import { Job } from '../models/Job.js';
import 'dotenv/config'
import Queue from "bull";
import axios from "axios";
export const jobProcessing = new Queue("job-processing", {
    redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME, // Redis 6+ ACL username
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DATABASE) || 0
    },
    settings: {
        maxStalledCount: 3 // Increase retries before failing
    }
})
jobProcessing.process(async (bullJob) => {
    const { jobId } = bullJob.data;
    console.log(`🔄 Fetching job ${jobId} from DB...`);
    const jobDoc = await Job.findById(jobId);
    if (!jobDoc) throw new Error(`Job ${jobId} not found in DB`);
    console.log(`🚀 Running GraphQL query for job ${jobId}...`);
    let result;
    switch (jobDoc.type) {
        case "outbound-call":
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
                    "preContext": jobDoc.payload.preContext
                },
                endpoint: `https://chatapi.campusroot.com/graphql/`,
                token: jobDoc.payload.accessToken
            });
            break;
        default:
            break;
    }

    console.log(`✅ GraphQL result for job ${jobId}:`, result);
    await Job.findByIdAndUpdate(jobId, { status: "completed", result_ref: result });
    return result;
});
// ---- Events ----
jobProcessing.on("completed", async (job, result) => {
    console.log(`🎉 Job ${job.id} completed with result:`, result);
    await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "completed" });
    job.remove(); // clear from Redis after completion
});

jobProcessing.on("failed", async (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
    await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "failed" });
    job.remove(); // clear from Redis after completion
});

jobProcessing.on("stalled", async (job) => {
    console.warn(`⚠️ Job ${job.id} stalled, retrying...`);
    await Job.findOneAndUpdate({ bullMQJobId: job.id }, { status: "stalled" });
    job.remove(); // clear from Redis after completion
});

export const syncWithDB = async () => {
    const now = new Date();
    const sixHoursLater = new Date(now.getTime() + 7 * 60 * 60 * 1000); // add 7 hours
    const jobs = await Job.find({
        "schedule.run_at": { $gte: now, $lte: sixHoursLater }, // between now & 6h
        "schedule.cancel_requested": false,
        bullMQJobId: { $exists: false },
    }).sort({ "schedule.run_at": 1 });
    for (const job of jobs) {
        await scheduleJob(job._id, job.schedule.run_at);
    }
}
// ---- Functions ----
export const fetchJob = async (bullJobId) => {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    return job;
}
// ---- Functions ----
export async function scheduleJob(jobId, scheduledTime) {
    const delay = Math.max(0, new Date(scheduledTime).getTime() - Date.now());
    const scheduledJob = await jobProcessing.add(
        { jobId },
        {
            delay,
            attempts: 3,
            backoff: { type: "exponential", delay: 60000 },
            removeOnComplete: true, // auto-remove after success
            removeOnFail: false,
            removeOnStalled: true,
        }
    );
    console.log("Scheduled job in queue:", scheduledJob);
    await Job.findOneAndUpdate({ _id: jobId }, { bullMQJobId: scheduledJob.id });
    return scheduledJob;
}
export async function rescheduleJob(bullJobId, newTime) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    const delay = Math.max(0, new Date(newTime).getTime() - Date.now());
    const rescheduledJob = await jobProcessing.add(
        job.data,
        {
            delay,
            attempts: 3,
            backoff: { type: "exponential", delay: 60000 },
            removeOnComplete: true, // auto-remove after success
            removeOnFail: true,
            removeOnStalled: true,
        }
    );
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "scheduled", bullMQJobId: rescheduledJob.id });
    return rescheduledJob;
}
export async function cancelJob(bullJobId) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "canceled", "schedule.cancel_requested": true });
    return job;
}
export async function retryJob(bullJobId) {
    const job = await jobProcessing.getJob(bullJobId);
    if (!job) throw new Error(`Job ${bullJobId} not found`);
    await job.remove();
    await Job.findOneAndUpdate({ bullMQJobId: bullJobId }, { status: "retry" });
    return job;
}
async function runGraphQLQuery(endpoint, query, variables, accessToken) {

    try {
        const response = await axios.post(endpoint, { query, variables },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`, // optional
                },
            }
        );
        console.log("GraphQL Response:", response.data.data);
    } catch (error) {
        console.error("GraphQL Error:", error.response?.data || error.message);
    }
}
