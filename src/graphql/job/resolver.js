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
import { Conversation } from "../../models/Conversations.js";
import axios from "axios";
import { ExotelService } from "../../utils/exotel.js";
import { TwilioService } from "../../utils/twilio.js";
import { TataTeleService } from "../../utils/tataTele.js";
import { fireAndForgetAxios } from "../../utils/fireAndForget.js";
const { DOMAIN, TWILIO_AUTH_TOKEN } = process.env;
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
            await Business.populate(campaigns, { path: 'business', select: nested.business });
            await User.populate(campaigns, { path: 'createdBy', select: nested.createdBy });
            await AgentModel.populate(campaigns, { path: 'agent', select: nested.agent });
            await Channel.populate(campaigns, { path: 'communicationChannels', select: nested.communicationChannels });
            return campaigns;
        }
    },
    Mutation: {
        createCampaign: async (_, { name, communicationChannels, leads, nodes, edges }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const { newAccessToken } = await generateTokens(context.user._id)
            const newCampaign = await Campaign.create({ communicationChannels, name, leads, business: context.user.business, createdBy: context.user._id, execution: { nodes: nodes.map(node => ({ ...node, nodeConfig: { ...node.nodeConfig, accessKey: newAccessToken } })), edges } });
            await Business.populate(newCampaign, { path: 'business', select: nested.business });
            await User.populate(newCampaign, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(newCampaign, { path: 'communicationChannels', select: nested.communicationChannels });
            await newCampaign.save();
            fireAndForgetAxios("POST", `https://chat.avakado.ai/aux/trigger/${newCampaign._id}`, {}, { headers: { "Content-Type": "application/json" } });
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
            await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "createJob", data: null });
            await Business.populate(newJob, { path: 'business', select: nested.business });
            await User.populate(newJob, { path: 'createdBy', select: nested.createdBy });
            return newJob;
        },
        deleteJob: async (_, { id }, context, info) => {
            const job = await Job.findOne({ _id: id, business: context.user.business });
            if (!job) throw new GraphQLError("Invalid Id")
            await Job.findByIdAndDelete(id);
            await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "deleteJob", data: { id } });
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
            await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "rescheduleJob", data: { id, scheduledTime: schedule.run_at } });
            await Business.populate(job, { path: 'business', select: nested.business });
            await User.populate(job, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(job, { path: 'payload.channel', select: nested.payload.channel });
            await AgentModel.populate(job, { path: 'payload.agent', select: nested.payload.agent });
            return job;
        },
        makeAnOutboundCall: async (_, { number, channelId, PreContext = "", campaignId = null }, context, info) => {
            const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
            if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            console.log("channel.business.credits.balance:", channel.business.credits.balance);
            if (channel.business.credits.balance <= 100) throw new GraphQLError("Insufficient credits", { extensions: { code: "INSUFFICIENT_CREDITS" } });
            const agentDetails = await AgentModel.findOne({ channels: channel._id }, "_id personalInfo.VoiceAgentSessionConfig");
            if (!agentDetails) throw new GraphQLError("Agent not found", { extensions: { code: "AGENT_NOT_FOUND" } });
            const conversation = await Conversation.create({ business: channel.business, channel: channel.type, channelFullDetails: channel._id, agent: agentDetails._id, PreContext, contact: { phone: number }, metadata: { status: "initiated" } });
            let callDetails = null;
            switch (channel.config.provider) {
                case 'exotel':
                    const { apiKey, apiToken } = channel.config.integration.secrets;
                    const { AccountSid, domain, region } = channel.config.integration.config;
                    const exotelService = new ExotelService(apiKey, apiToken, AccountSid, domain, region);
                    const customField = { conversationId: conversation._id, model: agentDetails.personalInfo.VoiceAgentSessionConfig.model, webSocketsUrl: encodeURIComponent(channel.config.webSocketsUrl) }
                    callDetails = await exotelService.outboundCallToFlow({ number, CallerId: channel.config.phoneNumber, webhookUrl: channel.config.voiceUpdatesWebhookUrl + conversation._id.toString(), VoiceAppletId: channel.config.exotelVoiceAppletId, customField });
                    break;
                case 'twilio':
                    const service = new TwilioService(channel.config.integration.config.AccountSid, TWILIO_AUTH_TOKEN);
                    callDetails = await service.makeAIOutboundCall({ to: number, from: channel.config.phoneNumber, url: channel.config.webSocketsUrl, webhookUrl: channel.config.voiceUpdatesWebhookUrl + conversation._id.toString(), conversationId: conversation._id.toString(), model: agentDetails.personalInfo.VoiceAgentSessionConfig.model });
                    break;
                case 'tataTele':
                    const tataTeleService = new TataTeleService(channel.config.integration.secrets.apiKey);
                    callDetails = await tataTeleService.outboundCallToFlow({ number, CallerId: channel.config.phoneNumber, customField: { conversationId: conversation._id, model: agentDetails.personalInfo.VoiceAgentSessionConfig.model } });
                    console.log("tataTele callDetails:", JSON.stringify(callDetails, null, 2));
                    break;
                default:
                    throw new GraphQLError("Invalid provider", { extensions: { code: "INVALID_PROVIDER" } });
            }
            conversation.voiceCallIdentifierNumberSID = callDetails.Sid;
            conversation.campaign = campaignId;
            conversation.metadata.callDetails = { ...JSON.parse(JSON.stringify(callDetails || {})) };
            await conversation.save();
            return conversation;
        },
        testTataTele: async (_, { channelId, action, data }, context, info) => {
            const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
            if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            const tataTeleService = new TataTeleService(channel.config.integration.secrets.apiKey, channel.config.integration.secrets.apiToken);
            switch (action) {
                case "activeCalls":
                    const activeCalls = await tataTeleService.activeCalls();
                    return activeCalls;
                case "existingPhoneNumbers":
                    const existingPhoneNumbers = await tataTeleService.existingPhoneNumbers();
                    return existingPhoneNumbers;
                case "updatePhoneNumber":
                    const updatedPhoneNumber = await tataTeleService.updatePhoneNumber(channel.config.phoneNumber, data);
                    return updatedPhoneNumber;
                default:
                    throw new GraphQLError("Invalid test", { extensions: { code: "INVALID_TEST" } });
            }
        },
        exotelCampaignSetup: async (_, { contacts, channelId, schedule }, context, info) => {
            const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
            if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
            const { apiKey, apiToken } = channel.config.integration.secrets;
            const { AccountSid, domain, region } = channel.config.integration.config;
            const exotelService = new ExotelService(apiKey, apiToken, AccountSid, domain, region);
            console.log(schedule);
            const campaign = await exotelService.createCampaign(channel.config.exotelVoiceAppletId, channel.config.exotelCallerId, contacts, { "send_at": new Date(schedule.startAt).toISOString() || new Date().toISOString(), "end_at": new Date(schedule.endAt).toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
            return campaign;
        }
    }
}