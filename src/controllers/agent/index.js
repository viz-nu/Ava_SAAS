import { errorWrapper } from '../../middleware/errorWrapper.js';
import { Action } from '../../models/Action.js';
import { AgentModel } from '../../models/Agent.js';
import { Business } from '../../models/Business.js';
import { Collection } from '../../models/Collection.js';
import { agentSchema } from '../../Schema/index.js';
import { Telegraf } from "telegraf";
import { openai } from '../../utils/openai.js';
import { randomBytes } from 'crypto';
import axios from 'axios';
const { wa_client_id, wa_client_secret, SERVER_URL } = process.env;
export const integrations = errorWrapper(async (req, res) => {
    const [business, agent] = await Promise.all([Business.findById(req.user.business), AgentModel.findById(req.params.id)]);
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.agents.includes(req.params.id)) return { statusCode: 403, message: "Unauthorized", data: null }
    const { telegramToken, whatsappCode, phone_number_id, waba_id, business_id } = req.body
    if (telegramToken) {
        if (agent.integrations?.telegram?.botToken) {
            const existingBotToken = agent.integrations.telegram.botToken;
            const existingBot = new Telegraf(existingBotToken);
            await existingBot.telegram.deleteWebhook();
            delete agent.integrations.telegram;
        }
        else {
            const bot = new Telegraf(telegramToken);
            let botInfo
            try {
                botInfo = await bot.telegram.getMe(); // Fetch bot details 
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "invalid telegramToken", data: { telegramToken } };
            }
            const webhookUrl = `${process.env.SERVER_URL}webhook/telegram/${botInfo.id}`;
            // const webhookUrl = `https://chatapi.campusroot.com/webhook/telegram/${botInfo.id}`;
            try {
                await bot.telegram.setWebhook(webhookUrl);
            } catch (error) {
                console.log(error);
                return { statusCode: 500, message: "Internal Server Error While Setting Up Telegram Webhook", data: null };
            }
            agent.integrations.telegram = { userName: botInfo.username, id: botInfo.id, webhookUrl, botToken: telegramToken }
        }
        await agent.save()
    }
    if (whatsappCode && phone_number_id && waba_id && business_id) {
        const API_VERSION = 'v23.0';
        try {
            const response = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${wa_client_id}&client_secret=${wa_client_secret}&code=${whatsappCode}`);
            agent.integrations.whatsapp.permanentAccessToken = response.data.access_token;
            agent.integrations.whatsapp.updatedAt = new Date()
            agent.integrations.whatsapp.phone_number_id = phone_number_id;
            agent.integrations.whatsapp.waba_id = waba_id;
            agent.integrations.whatsapp.phoneNumberPin = Math.floor(Math.random() * 900000) + 100000
            agent.integrations.whatsapp.business_id = business_id;
            agent.integrations.whatsapp.webhookUrl = `${SERVER_URL}webhook/whatsapp/${agent._id}`;
            agent.integrations.whatsapp.verificationToken = randomBytes(9).toString('hex');
            agent.integrations.whatsapp.status = "token_verified";
            await AgentModel.findByIdAndUpdate(req.params.id, { $set: { "integrations.whatsapp": agent.integrations.whatsapp } })
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`, { "override_callback_uri": agent.integrations.whatsapp.webhookUrl, "verify_token": agent.integrations.whatsapp.verificationToken }, { headers: { 'Authorization': `Bearer ${agent.integrations.whatsapp.permanentAccessToken}` } });
            await AgentModel.findByIdAndUpdate(req.params.id, { $set: { "integrations.whatsapp.status": "callback_uri_verified" } })
            await axios.post(`https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`, { 'messaging_product': 'whatsapp', 'pin': agent.integrations.whatsapp.phoneNumberPin }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agent.integrations.whatsapp.permanentAccessToken}` } });
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error("Axios error occurred while integrating whatsapp:");
                if (error.response) console.error("Error details:", { "Response data": error.response.data, "Status code": error.response.status, "Headers": error.response.headers });// Server responded with a status outside 2xx
                else if (error.request) console.error("No response received:", error.request); // No response received
                else console.error("Error message:", error.message);// Request setup issue
            } else console.error("Unexpected error:", error);  // Non-Axios error
        }
    }
    return { statusCode: 200, message: "Integration Updated", data: agent };
})
export const createAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    const { appearance, personalInfo, tools } = req.body
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    // for (const id of collections) {
    //     const collection = await Collection.findById(id);
    //     if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    //     if (collection.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this collection", data: { collectionId: id } }
    // }
    // for (const id of actions) {
    //     const action = await Action.findById(id);
    //     if (!action) return { statusCode: 404, message: "action not found", data: null }
    //     if (action.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this action", data: { collectionId: id } }
    // }
    // personalInfo.assistantId = await createAnAssistant({ name: personalInfo.name || 'Custom Assistant', instructions: personalInfo.systemPrompt || "", model: personalInfo.model || 'gpt-4.1-mini', temperature: personalInfo.temperature || 0.5 });
    const agent = await AgentModel.create({ appearance, personalInfo, tools, business: business._id, createdBy: req.user._id });
    business.agents.push(agent._id)
    await business.save()
    return { statusCode: 201, message: "New agent added", data: agent };
});
export const getAllAgents = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate("agents");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return { statusCode: 200, message: "Agents retrieved", data: business.agents }
});
export const getAgentById = errorWrapper(async (req, res) => {
    const agent = await AgentModel.findById(req.params.id).populate('collections business createdBy');
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    const business = await Business.findById(req.user.business);
    if (!business || !business.agents.includes(agent._id)) return { statusCode: 403, message: "Unauthorized", data: null }
    return { statusCode: 200, message: "Agent retrieved", data: agent };
});
export const updateAgent = errorWrapper(async (req, res) => {
    await agentSchema.validate(req.body, { abortEarly: false });
    const [business, agent] = await Promise.all([Business.findById(req.user.business), AgentModel.findById(req.params.id)]);
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.agents.includes(req.params.id)) return { statusCode: 403, message: "Unauthorized", data: null }
    const { appearance, personalInfo, tools } = req.body
    // if (collections) {
    //     for (const id of collections) {
    //         const collection = await Collection.findById(id);
    //         if (!collection) return { statusCode: 404, message: "Collection not found", data: null }
    //         if (collection.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this collection", data: { collectionId: id } }
    //     }
    //     agent.collections = collections;
    // }
    // if (actions) {
    //     for (const id of actions) {
    //         const action = await Action.findById(id);
    //         if (!action) return { statusCode: 404, message: "action not found", data: null }
    //         if (action.business.toString() != business._id.toString()) return { statusCode: 404, message: "your business doesn't have access to this action", data: { actionId: id } }
    //     }
    //     agent.actions = actions;
    // }
    if (tools) agent.tools = tools;
    if (appearance) agent.appearance = appearance;
    if (personalInfo) {
        const { name, systemPrompt, role, temperature, model, welcomeMessage, quickQuestions, facts, noDataMail } = personalInfo
        if (noDataMail) agent.personalInfo.noDataMail = noDataMail;
        if (name) agent.personalInfo.name = name;
        if (systemPrompt) agent.personalInfo.systemPrompt = systemPrompt;
        if (temperature) agent.personalInfo.temperature = temperature;
        if (model) agent.personalInfo.model = model;
        if (role) agent.personalInfo.role = role;
        if (welcomeMessage) agent.personalInfo.welcomeMessage = welcomeMessage;
        if (quickQuestions) agent.personalInfo.quickQuestions = quickQuestions;
        if (facts) agent.personalInfo.facts = facts;
        // if (name || systemPrompt || temperature || model) await updateAnAssistant({
        //     assistantId: agent.personalInfo.assistantId, name: personalInfo.name, instructions: personalInfo.systemPrompt || "", model: personalInfo.model || "gpt-4o-mini-2024-07-18", temperature: personalInfo.temperature || 0.8
        // })
    }
    await agent.save();
    return { statusCode: 200, message: "Agent updated", data: agent };
});
export const deleteAgent = errorWrapper(async (req, res) => {
    // Find the collection by ID
    const agent = await AgentModel.findById(req.params.id);
    if (!agent) return { statusCode: 404, message: "Agent not found", data: null }
    // Ensure that the collection belongs to the user's business
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    if (!business.agents.includes(req.params.id)) return { statusCode: 404, message: "You are not authorized to delete this collection", data: null }
    await Promise.all([
        // deleteAnAssistant({ assistantId: agent.personalInfo.assistantId }),
        AgentModel.findByIdAndDelete(req.params.id),
        Business.updateMany({ agents: req.params.id }, { $pull: { agents: req.params.id } })
    ])
    return { statusCode: 200, message: "Agent deleted successfully" };
});
export const promptGenerator = errorWrapper(async (req, res) => {
    const { prompt } = req.body;
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const systemInstruction = `You are an expert prompt engineer. Your job is to take a rough or draft input describing an AI assistant and generate a polished, detailed, and optimized system prompt. The final output should clearly define the assistant's name, role, goals, tone, limitations, language, audience, response style, and fallback behavior in a structured and professional format.`;
    const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: JSON.stringify(prompt) }
        ],
        max_tokens: 500,
    });
    return { statusCode: 200, message: "Prompt generated successfully", data: aiResponse.choices[0].message.content.trim() };
});