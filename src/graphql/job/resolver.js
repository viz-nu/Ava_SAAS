import graphqlFields from "graphql-fields";
import { flattenFields, getSelectFields } from "../../utils/graphqlTools.js";
import { GraphQLError } from "graphql";
import { Campaign, Task } from "../../models/Campaign.js";
import { Business } from "../../models/Business.js";
import { User } from "../../models/User.js";
import { Channel } from '../../models/Channels.js';
import { sendKafkaMessage } from "../../utils/kafka.js";
import { Lead } from "../../models/Leads.js";
import { buildComponents } from "../../utils/tools.js";
export const jobResolvers = {
    Query: {
        fetchCampaigns: async (_, { id, name, channelIds, leadIds, status, limit = 10, page = 1 }, context, info) => {
            const filter = { business: context.user.business };
            if (id) filter._id = id;
            if (name) filter.name = { $regex: name, $options: "i" };
            if (channelIds) filter.channel = { $in: channelIds };
            if (leadIds) filter.leads = { $in: leadIds };
            if (status) filter.status = status;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { rootFields, populateFields } = getSelectFields(requestedFields.data);
            const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(rootFields);
            const totalDocuments = await Campaign.countDocuments(filter);
            if (populateFields?.business) await Business.populate(campaigns, { path: 'business', select: populateFields.business });
            if (populateFields?.createdBy) await User.populate(campaigns, { path: 'createdBy', select: populateFields.createdBy });
            if (populateFields?.channel) await Channel.populate(campaigns, { path: 'channel', select: populateFields.channel });
            return { data: campaigns, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        },
        fetchTasks: async (_, { campaignId, status, limit = 10, page = 1 }, context, info) => {
            const filter = { business: context.user.business };
            if (campaignId) filter.campaign = campaignId;
            if (status) filter.status = status;
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { rootFields, populateFields } = getSelectFields(requestedFields.data);
            const tasks = await Task.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(rootFields);
            const totalDocuments = await Task.countDocuments(filter);
            if (populateFields?.business) await Business.populate(tasks, { path: 'business', select: populateFields.business });
            if (populateFields?.campaign) await Campaign.populate(tasks, { path: 'campaign', select: populateFields.campaign });
            if (populateFields?.lead) await Lead.populate(tasks, { path: 'lead', select: populateFields.lead });
            return { data: tasks, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
        }
    },
    Mutation: {
        createCampaign: async (_, { name, channelId, leadIds, config = { scheduledAt: new Date(Date.now() + 10 * 60 * 1000) } }, context, info) => {
            const requestedFields = graphqlFields(info, {}, { processArguments: false });
            const { projection, nested } = flattenFields(requestedFields);
            const channel = await Channel.findById(channelId).populate("provider");
            if (!channel) throw new GraphQLError("Channel not found");
            const tasks = [];
            switch (channel.provider.name) {
                case "Whatsapp":
                    const { template: { templateName, languageCode, parametersMap = [] } } = config;
                    if (!templateName || !languageCode) throw new GraphQLError("templateName, languageCode are required");
                    for (const leadId of leadIds) {
                        let lead = await Lead.findById(leadId);
                        if (!lead) throw new GraphQLError("Lead not found");
                        const data = { lead }
                        const components = buildComponents(parametersMap, data);
                        console.log("components", components);
                        tasks.push({
                            type: "quick",
                            data: {
                                input: {
                                    "to": lead.contactDetails.whatsapp?.find(entry => entry.isPrimary)?.handle ?? lead.contactDetails.whatsapp?.[0]?.handle ?? lead.contactDetails.phone?.[0]?.handle,
                                    templateName,
                                    languageCode,
                                    components: components
                                },
                                config: { "phoneNumberId": channel.config.phoneNumberId },
                                apiId: "6a4c109329ef086643c24211",
                                authId: channel.apiAuthenticator
                            }
                        });
                    }
                    break;
                default:
                    throw new GraphQLError("Cannot service campaign for this channel", { extensions: { code: "Invalid_Channel" } });
            }
            const newCampaign = await Campaign.create({ name, business: context.user.business, channel: channelId, leads: leadIds, config, status: "pending", timeLines: { scheduledAt: new Date(config.scheduledAt), startedAt: null, completedAt: null, cancelledAt: null }, cancel_requested: false, createdBy: context.user._id, });
            await Task.insertMany(tasks.map(task => ({ ...task, campaign: newCampaign._id, business: context.user.business })));
            await sendKafkaMessage({
                topic: 'cron-job', messages: [{
                    key: "create",
                    value: JSON.stringify({
                        id: newCampaign._id,
                        name: newCampaign.name,
                        scheduleType: 'once',
                        runAt: newCampaign.config.scheduledAt,
                        type: "http",
                        url: "https://chat.avakado.ai/aux/trigger/" + newCampaign._id,
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        params: {},
                        body: {},
                        enabled: true,
                        miscIds: {}
                    })
                }]
            });
            await User.populate(newCampaign, { path: 'createdBy', select: nested.createdBy });
            await Channel.populate(newCampaign, { path: 'communicationChannels', select: nested.communicationChannels });
            return newCampaign;
        },
        cancelCampaign: async (_, { id }, context, info) => {
            const campaign = await Campaign.findByIdAndUpdate(id, { cancel_requested: true }, { new: true });
            if (!campaign) throw new GraphQLError("Campaign not found");
            return campaign;
        }
    }
}



// import graphqlFields from "graphql-fields";
// import { Job } from "../../models/Job.js";
// import { flattenFields, getSelectFields } from "../../utils/graphqlTools.js";
// import { GraphQLError } from "graphql";
// import { Campaign } from "../../models/Campaign.js";
// import { Business } from "../../models/Business.js";
// import { User } from "../../models/User.js";
// import { Channel } from '../../models/Channels.js';
// import { AgentModel } from "../../models/Agent.js";
// import { Conversation } from "../../models/Conversations.js";
// import axios from "axios";
// import { ExotelService } from "../../utils/exotel.js";
// import { TwilioService } from "../../utils/twilio.js";
// import { TataTeleService } from "../../utils/tataTele.js";
// import { fireAndForgetAxios } from "../../utils/fireAndForget.js";
// import AuthService from "../../services/authService.js";
// const { TWILIO_AUTH_TOKEN } = process.env;
// export const jobResolvers = {
//     Query: {
//         fetchJobs: async (_, { campaignId, status, priority, jobType, id, schedule_type, schedule_run_at, limit = 10, page = 1 }, context, info) => {
//             const filter = { business: context.user.business };
//             if (campaignId) filter.campaign = campaignId;
//             if (status) filter.status = status;
//             if (priority) filter.priority = priority;
//             if (jobType) filter.jobType = jobType;
//             if (id) filter._id = id;
//             if (schedule_type) filter["scheduletype"] = schedule_type;
//             if (schedule_run_at) filter["schedule.run_at"] = schedule_run_at;
//             const requestedFields = graphqlFields(info, {}, { processArguments: false });
//             const { rootFields, populateFields } = getSelectFields(requestedFields);
//             const jobs = await Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(rootFields);
//             if (populateFields?.business) await Business.populate(jobs, { path: 'business', select: populateFields.business });
//             if (populateFields?.createdBy) await User.populate(jobs, { path: 'createdBy', select: populateFields.createdBy });
//             if (populateFields?.payload.channel) await Channel.populate(jobs, { path: 'payload.channel', select: populateFields.payload.channel });
//             if (populateFields?.payload.agent) await AgentModel.populate(jobs, { path: 'payload.agent', select: populateFields.payload.agent });
//             return jobs;
//         },
//         fetchCampaigns: async (_, { id, limit = 10, page = 1 }, context, info) => {
//             const filter = { business: context.user.business };
//             if (id) filter._id = id;
//             const requestedFields = graphqlFields(info, {}, { processArguments: false });
//             const { rootFields, populateFields } = getSelectFields(requestedFields.data);
//             const campaigns = await Campaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(rootFields);
//             const totalDocuments = await Campaign.countDocuments(filter);
//             if (populateFields?.business) await Business.populate(campaigns, { path: 'business', select: populateFields.business });
//             if (populateFields?.createdBy) await User.populate(campaigns, { path: 'createdBy', select: populateFields.createdBy });
//             if (populateFields?.agent) await AgentModel.populate(campaigns, { path: 'agent', select: populateFields.agent });
//             if (populateFields?.communicationChannels) await Channel.populate(campaigns, { path: 'communicationChannels', select: populateFields.communicationChannels });
//             return { data: campaigns, metaData: { page, limit, totalPages: Math.ceil(totalDocuments / limit), totalDocuments } };
//         }
//     },
//     Mutation: {
//         createCampaign: async (_, { name, communicationChannels, leads, nodes = [], edges = [] }, context, info) => {
//             const requestedFields = graphqlFields(info, {}, { processArguments: false });
//             const { projection, nested } = flattenFields(requestedFields);
//             const { newAccessToken } = AuthService.generateTokens(context.user._id, '30d')
//             const newCampaign = await Campaign.create({ communicationChannels, name, leads, business: context.user.business, createdBy: context.user._id, execution: { nodes: nodes?.map(node => ({ ...node, nodeConfig: { ...node.nodeConfig, accessKey: newAccessToken } })), edges } });
//             await Business.populate(newCampaign, { path: 'business', select: nested.business });
//             await User.populate(newCampaign, { path: 'createdBy', select: nested.createdBy });
//             await Channel.populate(newCampaign, { path: 'communicationChannels', select: nested.communicationChannels });
//             await newCampaign.save();
//             fireAndForgetAxios("POST", `https://chat.avakado.ai/aux/trigger/${newCampaign._id}`, {}, { headers: { "Content-Type": "application/json" } });
//             return newCampaign;
//         },
//         createJob: async (_, { name, description, payload, schedule, tags, priority }, context, info) => {
//             const requestedFields = graphqlFields(info, {}, { processArguments: false });
//             const { projection, nested } = flattenFields(requestedFields);
//             if (new Date(schedule.run_at) > new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) throw new GraphQLError("Schedule run at date should not be greater than 14 days from now")
//             if (new Date(schedule.run_at) < new Date(Date.now() + 60 * 1000)) throw new GraphQLError("Schedule run at date should not be less than 1 minute from now")
//             // verify that payload.channel , schedule.run_at exist in db already and then add 1sec to prevent overlap
//             const existingJob = await Job.findOne({ $and: [{ 'payload.channel': payload.channel }, { 'schedule.run_at': new Date(schedule.run_at) }] });
//             while (existingJob) {
//                 schedule.run_at = new Date(schedule.run_at.getTime() + 1000 / payload.cps);
//                 existingJob = await Job.findOne({ $and: [{ 'payload.channel': payload.channel }, { 'schedule.run_at': new Date(schedule.run_at) }] });
//             }
//             schedule.run_at = new Date(schedule.run_at);
//             const { newAccessToken } = AuthService.generateTokens(context.user._id, '30d')
//             payload.accessToken = newAccessToken
//             const newJob = await Job.create({ name, description, payload, schedule, tags, priority, business: context.user.business, createdBy: context.user._id, jobType: "outboundCall", log: [{ level: "info", message: "Job created" }] });
//             await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "createJob", data: null });
//             await Business.populate(newJob, { path: 'business', select: nested.business });
//             await User.populate(newJob, { path: 'createdBy', select: nested.createdBy });
//             return newJob;
//         },
//         deleteJob: async (_, { id }, context, info) => {
//             const job = await Job.findOne({ _id: id, business: context.user.business });
//             if (!job) throw new GraphQLError("Invalid Id")
//             await Job.findByIdAndDelete(id);
//             await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "deleteJob", data: { id } });
//             return true;
//         },
//         updateJobSchedule: async (_, { id, schedule }, context, info) => {
//             const requestedFields = graphqlFields(info, {}, { processArguments: false });
//             const { projection, nested } = flattenFields(requestedFields);
//             const job = await Job.findOne({ _id: id, business: context.user.business });
//             if (!job) throw new GraphQLError("Invalid Id")
//             job.schedule = schedule
//             job.log.push({
//                 level: "info",
//                 message: "Job schedule updated",
//                 data: {
//                     schedule: schedule
//                 }
//             })
//             await job.save();
//             await axios.post(`${process.env.BULL_URL}api/queues/triggerSync`, { action: "rescheduleJob", data: { id, scheduledTime: schedule.run_at } });
//             await Business.populate(job, { path: 'business', select: nested.business });
//             await User.populate(job, { path: 'createdBy', select: nested.createdBy });
//             await Channel.populate(job, { path: 'payload.channel', select: nested.payload.channel });
//             await AgentModel.populate(job, { path: 'payload.agent', select: nested.payload.agent });
//             return job;
//         },
//         makeAnOutboundCall: async (_, { number, channelId, PreContext = "", campaignId = null, leadId = null }, context, info) => {
//             const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
//             if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
//             const business = await Business.findById(context.user.business).select({ credits: 1 });
//             if (business.credits.balance <= 100) throw new GraphQLError("Insufficient credits", { extensions: { code: "INSUFFICIENT_CREDITS" } });
//             const agentDetails = await AgentModel.findOne({ channels: channel._id }, "_id personalInfo.VoiceAgentSessionConfig workflow");
//             if (!agentDetails) throw new GraphQLError("Agent not found", { extensions: { code: "AGENT_NOT_FOUND" } });
//             const conversation = await Conversation.create({
//                 business: channel.business,
//                 channel: channel.type,
//                 channelFullDetails: channel._id, agent: agentDetails._id, PreContext, contact: { phone: number }, metadata: { status: "initiated" },
//                 workflow: agentDetails.workflow,
//                 lead: leadId
//             });
//             const { data } = await axios.post(`https://sockets.avakado.ai/session`, { "conversationId": conversation._id, "model": agentDetails.personalInfo.VoiceAgentSessionConfig.model, "tsp": channel.config.provider });
//             console.log("session created", data);
//             let callDetails = null;
//             switch (channel.config.provider) {
//                 case 'exotel': {
//                     const { apiKey, apiToken } = channel.config.integration.secrets;
//                     const { AccountSid, domain, region } = channel.config.integration.config;
//                     const exotelService = new ExotelService(apiKey, apiToken, AccountSid, domain, region);
//                     const customField = { conversationId: conversation._id, model: agentDetails.personalInfo.VoiceAgentSessionConfig.model, webSocketsUrl: encodeURIComponent(channel.config.webSocketsUrl) }
//                     callDetails = await exotelService.outboundCallToFlow({ number, CallerId: channel.config.phoneNumber, webhookUrl: channel.config.voiceUpdatesWebhookUrl + conversation._id.toString(), VoiceAppletId: channel.config.exotelVoiceAppletId, customField });
//                     break;
//                 }
//                 case 'twilio':
//                     const service = new TwilioService(channel.config.integration.config.AccountSid, TWILIO_AUTH_TOKEN);
//                     callDetails = await service.makeAIOutboundCall({ to: number, from: channel.config.phoneNumber, url: channel.config.webSocketsUrl, webhookUrl: channel.config.voiceUpdatesWebhookUrl + conversation._id.toString(), conversationId: conversation._id.toString(), model: agentDetails.personalInfo.VoiceAgentSessionConfig.model });
//                     break;
//                 case 'tataTele': {
//                     const { apiKey, apiToken } = channel.config.integration.secrets;
//                     const tataTeleService = new TataTeleService(apiKey, apiToken);
//                     callDetails = await tataTeleService.outboundCallToFlow({ number, CallerId: channel.config.phoneNumber, customField: { conversationId: conversation._id, model: agentDetails.personalInfo.VoiceAgentSessionConfig.model } });
//                     break;
//                 }
//                 default:
//                     throw new GraphQLError("Invalid provider", { extensions: { code: "INVALID_PROVIDER" } });
//             }
//             conversation.voiceCallIdentifierNumberSID = callDetails.Sid;
//             conversation.campaign = campaignId;
//             conversation.metadata.callDetails = { ...JSON.parse(JSON.stringify(callDetails || {})) };
//             await conversation.save();
//             return conversation;
//         },
//         testTataTele: async (_, { channelId, action, data }, context, info) => {
//             const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
//             if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
//             const tataTeleService = new TataTeleService(channel.config.integration.secrets.apiKey, channel.config.integration.secrets.apiToken);
//             switch (action) {
//                 case "activeCalls":
//                     const activeCalls = await tataTeleService.activeCalls();
//                     return activeCalls;
//                 case "existingPhoneNumbers":
//                     const existingPhoneNumbers = await tataTeleService.existingPhoneNumbers();
//                     return existingPhoneNumbers;
//                 case "updatePhoneNumber":
//                     const updatedPhoneNumber = await tataTeleService.updatePhoneNumber(channel.config.phoneNumber, data);
//                     return updatedPhoneNumber;
//                 default:
//                     throw new GraphQLError("Invalid test", { extensions: { code: "INVALID_TEST" } });
//             }
//         },
//         exotelCampaignSetup: async (_, { contacts, channelId, schedule }, context, info) => {
//             const channel = await Channel.findById(channelId).select({ config: 1, business: 1, type: 1 }).populate({ path: 'config.integration', select: { config: 1, secrets: 1 } }).lean();
//             if (!channel) throw new GraphQLError("Channel not found", { extensions: { code: "CHANNEL_NOT_FOUND" } });
//             const { apiKey, apiToken } = channel.config.integration.secrets;
//             const { AccountSid, domain, region } = channel.config.integration.config;
//             const exotelService = new ExotelService(apiKey, apiToken, AccountSid, domain, region);
//             const campaign = await exotelService.createCampaign(channel.config.exotelVoiceAppletId, channel.config.phoneNumber, contacts, { "send_at": new Date(schedule.startAt).toISOString() || new Date().toISOString(), "end_at": new Date(schedule.endAt).toISOString() || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
//             return campaign;
//         }
//     }
// }