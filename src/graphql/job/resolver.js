import graphqlFields from "graphql-fields";
import { Job } from "../../models/Job.js";
import { flattenFields } from "../../utils/graphqlTools.js";
import { GraphQLError } from "graphql";
import { Campaign } from "../../models/Campaign.js";
import { Business } from "../../models/Business.js";
import { User } from "../../models/User.js";
import { Channel } from '../../models/Channels.js';
import { AgentModel } from "../../models/Agent.js";
import { generateTokens } from "../../utils/tokens.js";
import { safeSync } from "../../utils/cron.js";
export const jobResolvers = {
    Query: {
        fetchJobs: async (_, { campaignId, status, priority, jobType, id, schedule_type, schedule_run_at, limit = 10, page = 1 }, context, info) => {
            const filter = { business: context.user.business };
            if (campaignId) filter.campaign = campaignId;
            if (status) filter.status = status;
            if (priority) filter.priority = priority;
            if (jobType) filter.jobType = jobType;
            if (id) filter._id = id;
            if (schedule_type) filter["scheduletype"] = schedule_type;
            if (schedule_run_at) filter["schedule.run_at"] = schedule_run_at;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const jobs = await Job.find(filter).select(projection).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            await Business.populate(jobs, { path: 'business', select: nested.business });
            await User.populate(jobs, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(jobs, { path: 'payload.channel', select: nested.payload.channel });
            await AgentModel.populate(jobs, { path: 'payload.agent', select: nested.payload.agent });
            return jobs;
        },
        fetchCampaigns: async (_, { id, limit = 10, page = 1 }, context, info) => {
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const campaigns = await Campaign.find(filter).select(projection).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
            // await Business.populate(campaigns, { path: 'business', select: nested.business });
            // await User.populate(campaigns, { path: 'createdBy', select: nested.createdBy });
            // await AgentModel.populate(campaigns, { path: 'agent', select: nested.agent });
            // await Channel.populate(campaigns, { path: 'communicationChannels', select: nested.communicationChannels });
            return campaigns;
        }
    },
    Mutation: {
        createCampaign: async (_, { name, agentId, receivers, schedule, cps }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            if (new Date(schedule.startAt) > new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) throw new GraphQLError("Schedule run at date should not be greater than 14 days from now")
            if (new Date(schedule.startAt) < new Date(Date.now() + 60 * 1000)) throw new GraphQLError("Schedule run at date should not be less than 1 minute from now")
            const newCampaign = await Campaign.create({ name, agent: agentId, receivers, schedule, cps, business: context.user.business, createdBy: context.user._id });
            // await Business.populate(newCampaign, { path: 'business', select: nested.business });
            // await User.populate(newCampaign, { path: 'createdBy', select: nested.createdBy });
            // await Channel.populate(newCampaign, { path: 'communicationChannels', select: nested.communicationChannels });
            // create jobs for each receiver
            const { newAccessToken } = await generateTokens(context.user._id)
            for (const [index, receiver] of Object.entries(newCampaign.receivers)) {
                const runAt = new Date(newCampaign.schedule.startAt.getTime() + (index * 1000 / cps))
                await Job.create({
                    name: newCampaign.name + " - " + receiver.personalInfo.name || "Anonymous",
                    description: "Outbound call to " + receiver.personalInfo.name || "Anonymous" + " from " + newCampaign.name,
                    business: context.user.business,
                    createdBy: context.user._id,
                    jobType: "outboundCall",
                    payload: {
                        to: receiver.personalInfo.contactDetails.phone,
                        agent: newCampaign.agent,
                        cps: newCampaign.cps,
                        channel: newCampaign.communicationChannels[0],
                        accessToken: newAccessToken
                    },
                    schedule: {
                        run_at: runAt,
                        type: "once",
                        timezone: new Date().getTimezoneOffset(),
                    },
                    tags: [newCampaign.name, receiver.personalInfo.name || "Anonymous", receiver.personalInfo.email || "AnonymousEmail"],
                    priority: 1,
                    log: [{
                        level: "info",
                        message: "Job created from campaign",
                        data: {
                            campaign: newCampaign._id,
                            receiver: receiver.personalInfo
                        }
                    }]
                });
            }
            await safeSync();
            return newCampaign;
        },
        createJob: async (_, { name, description, payload, schedule, tags, priority }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            if (new Date(schedule.run_at) > new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) throw new GraphQLError("Schedule run at date should not be greater than 14 days from now")
            if (new Date(schedule.run_at) < new Date(Date.now() + 60 * 1000)) throw new GraphQLError("Schedule run at date should not be less than 1 minute from now")
            // verify that payload.channel , schedule.run_at exist in db already and then add 1sec to prevent overlap
            const existingJob = await Job.findOne({ $and: [{ 'payload.channel': payload.channel }, { 'schedule.run_at': new Date(schedule.run_at) }] });
            while (existingJob) {
                schedule.run_at = new Date(schedule.run_at.getTime() + 1000 / payload.cps);
                existingJob = await Job.findOne({ $and: [{ 'payload.channel': payload.channel }, { 'schedule.run_at': new Date(schedule.run_at) }] });
            }
            schedule.run_at = new Date(schedule.run_at);
            const { newAccessToken } = await generateTokens(context.user._id)
            payload.accessToken = newAccessToken
            const newJob = await Job.create({ name, description, payload, schedule, tags, priority, business: context.user.business, createdBy: context.user._id, jobType: "outboundCall", log: [{ level: "info", message: "Job created" }] });
            await safeSync();
            await Business.populate(newJob, { path: 'business', select: nested.business });
            await User.populate(newJob, { path: 'createdBy', select: nested.createdBy });
            return newJob;
        },
        deleteJob: async (_, { id }, context, info) => {
            const job = await Job.findOne({ _id: id, business: context.user.business });
            if (!job) throw new GraphQLError("Invalid Id")
            await Job.findByIdAndDelete(id);
            await safeSync();
            return true;
        },
        updateJobSchedule: async (_, { id, schedule }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const job = await Job.findOne({ _id: id, business: context.user.business }).select(projection);
            if (!job) throw new GraphQLError("Invalid Id")
            job.schedule = schedule
            job.log.push({
                level: "info",
                message: "Job schedule updated",
                data: {
                    schedule: schedule
                }
            })
            await job.save();
            await safeSync();
            await Business.populate(job, { path: 'business', select: nested.business });
            await User.populate(job, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(job, { path: 'payload.channel', select: nested.payload.channel });
            await AgentModel.populate(job, { path: 'payload.agent', select: nested.payload.agent });
            return job;
        }
    }
}