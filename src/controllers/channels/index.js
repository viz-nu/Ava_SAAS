import { Telegraf } from "telegraf";
import { Business } from "../../models/Business.js";
import { Channel } from "../../models/Channels.js";
const { wa_client_id, wa_client_secret, SERVER_URL, IG_CLIENT_Secret, IG_ClIENT_ID } = process.env;
import axios from 'axios';
import FormData from 'form-data';
import { randomBytes } from "crypto"
import { errorWrapper } from "../../middleware/errorWrapper.js";
import { verifyTransporter } from "../../utils/sendEmail.js";
import { AgentModel } from "../../models/Agent.js";


export const fetchChannels = errorWrapper(async (req, res) => {
    const { type, status } = req.query;
    const filter = { business: req.user.business };
    if (req.params.id) filter._id = id;
    if (type) filter.type = type;
    if (status) filter.status = status;
    const channels = await Channel.find(filter, "-secrets");
    return { statusCode: 200, message: `Channels fetched`, data: channels };
});

export const createChannel = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    let { name, type, config, systemPrompt, isPublic, UIElements } = req.body;
    if (!type) return { statusCode: 404, message: "type of channel not found", data: null }
    const channel = await Channel.create({ name, business: req.user.business, type, status: "initiated", systemPrompt: "", isPublic: false, UIElements })
    switch (type) {
        case "email":
            const { host, port, secure, fromName, defaultRecipients: { }, authType, user, pass, service, clientId, clientSecret, refreshToken, accessToken, expires } = config;
            let mailConfig
            channel.config = { host, port, secure, service, fromName, defaultRecipients, verified: false, lastVerifiedAt: new Date() }
            channel.secrets = { authType, user, pass, clientId, clientSecret, refreshToken, accessToken, expires }
            if (authType === "login") mailConfig = { host, port, secure, auth: { user, pass } }
            else if (authType === "oauth2") mailConfig = { service, auth: { type: "OAuth2", user, clientId, clientSecret, refreshToken } }
            const { success } = await verifyTransporter(mailConfig)
            if (!success) {
                await channel.updateStatus("failed")
                return { statusCode: 400, message: "transporter verification failed", data: null }
            }
            await channel.save()
            await channel.updateStatus("success")
            break;
        case "telegram":
            const { telegramToken } = config
            if (!telegramToken || telegramToken.trim === "") return { statusCode: 403, message: "telegramToken not found", data: null }
            const bot = new Telegraf(telegramToken);
            try {
                const botInfo = await bot.telegram.getMe(); // Fetch bot details 
                channel.config = { ...botInfo, url: `https://t.me/${botInfo.username}` }
                channel.webhookUrl = `${process.env.SERVER_URL}webhook/telegram/${botInfo.id}`;
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "invalid telegramToken", data: { telegramToken } };
            }
            await channel.save()
            await channel.updateStatus("fetched bot details")
            try {
                await bot.telegram.setWebhook(channel.webhookUrl);
            } catch (error) {
                console.log(error);
                return { statusCode: 500, message: "Internal Server Error While Setting Up Telegram Webhook", data: null };
            }
            channel.secrets = { botToken: telegramToken }
            await channel.save()
            await channel.updateStatus("bot webhook set")
            break;
        case "whatsapp":
            const { whatsappCode, phone_number_id, waba_id, business_id } = config
            const API_VERSION = 'v23.0';
            if (!whatsappCode || !phone_number_id || !waba_id || !business_id || whatsappCode.trim === "") return { statusCode: 403, message: "requirements not fulfilled", data: null }
            try {
                const { data } = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${wa_client_id}&client_secret=${wa_client_secret}&code=${whatsappCode}`);
                channel.secrets = { permanentAccessToken: data.access_token, phoneNumberPin: Math.floor(Math.random() * 900000) + 100000, verificationToken: randomBytes(9).toString('hex') }
                channel.webhookUrl = `${SERVER_URL}webhook/whatsapp/${phone_number_id}`
                channel.config = { phone_number_id, waba_id, business_id }
            } catch (error) {
                if (error.response) {
                    console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                } else if (error.request) {
                    console.error("The request was made but no response was received");
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.error({ request: error.request });
                } else {
                    console.error('Error', error.message);
                }
                console.error(error.config);
                return { statusCode: 401, message: "whatsapp code verification failed", data: error };
            }
            await channel.save()
            await channel.updateStatus("fetched access token")
            try {
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`, { "override_callback_uri": channel.webhookUrl, "verify_token": channel.secrets.verificationToken }, { headers: { 'Authorization': `Bearer ${channel.secrets.permanentAccessToken}` } });
            } catch (error) {
                if (error.response) {
                    console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                } else if (error.request) {
                    console.error("The request was made but no response was received");
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.error({ request: error.request });
                } else {
                    console.error('Error', error.message);
                }
                console.error(error.config);
                return { statusCode: 401, message: "whatsapp webhook verification failed", data: error };
            }
            await channel.updateStatus("bot webhook set")
            try {
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`, { 'messaging_product': 'whatsapp', 'pin': channel.secrets.phoneNumberPin }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${channel.secrets.permanentAccessToken}` } });
            } catch (error) {
                if (error.response) {
                    console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                } else if (error.request) {
                    console.error("The request was made but no response was received");
                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                    // http.ClientRequest in node.js
                    console.error({ request: error.request });
                } else {
                    console.error('Error', error.message);
                }
                console.error(error.config);
                return { statusCode: 401, message: "registering ", data: error };
            }
            await channel.save()
            await channel.updateStatus("bot messaging_product set")
            break;
        case "web":
            break;
        case "phone":
            break;
        case "instagram":
            const { instagramCode } = config;
            if (!instagramCode || instagramCode.trim === "") return { statusCode: 403, message: "instagramCode not found", data: null }
            try {
                const form = new FormData();
                form.append('client_id', IG_ClIENT_ID);
                form.append('client_secret', IG_CLIENT_Secret);
                form.append('grant_type', 'authorization_code');
                form.append('redirect_uri', 'https://www.avakado.ai/integrations/instagram');
                form.append('code', instagramCode);
                const { data } = await axios.post('https://api.instagram.com/oauth/access_token', form, {
                    headers: form.getHeaders()
                })
                const { access_token, user_id, permissions } = data;
                channel.secrets = { accessToken: access_token, permissions, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }; // Set expiresAt to 1 hour from now
                channel.config = { user_id_graphAPI: user_id };
                await channel.save();
                await channel.updateStatus("fetched short living access token");
            } catch (error) {
                if (error.response) console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                else if (error.request) console.error("The request was made but no response was received", { request: error.request });
                else console.error('Error', error.message);
                console.error({ config: error.config });
                return { statusCode: 401, message: "Error exchanging code for token", data: error.response?.data || error.message };
            }
            try {
                const url = 'https://graph.instagram.com/access_token';
                const params = {
                    grant_type: 'ig_exchange_token',
                    client_secret: IG_CLIENT_Secret,
                    access_token: channel.secrets.accessToken,
                };
                const { data } = await axios.get(url, { params });
                const { access_token, token_type, expires_in } = data;
                channel.secrets = { accessToken: access_token, permissions, expiresAt: expires_in * 1000 + Date.now() };
                await channel.save();
                await channel.updateStatus("fetched long living access token");
            } catch (error) {
                if (error.response) console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                else if (error.request) console.error("The request was made but no response was received", { request: error.request });
                else console.error('Error', error.message);
                console.error({ config: error.config });
                return { statusCode: 401, message: "Error exchanging code for token", data: error.response?.data || error.message };
            }
            try {
                const url = `https://graph.instagram.com/v23.0/${channel.config.user_id_graphAPI}`;
                const params = {
                    fields: 'user_id,username,name,account_type,profile_picture_url',
                    access_token: channel.secrets.accessToken
                };
                const { data } = await axios.get(url, { params });
                const { user_id, username, name, account_type, profile_picture_url } = data;
                channel.config = { ...channel.config, igBusinessId: user_id, username, name, account_type, profile_picture_url };
                await channel.save();
                await channel.updateStatus("fetched user details");
            } catch (error) {
                if (error.response) console.error({ data: error.response.data, status: error.response.status, headers: error.response.headers });
                else if (error.request) console.error("The request was made but no response was received", { request: error.request });
                else console.error('Error', error.message);
                console.error({ config: error.config });
                return { statusCode: 401, message: "Error exchanging code for token", data: error.response?.data || error.message };
            }
            break;
        case "sms":
            break;
        default:
            break;
    }
    const sanitizedChannel = channel.toObject(); // Convert Mongoose doc to plain JS object
    delete sanitizedChannel.secrets;
    return { statusCode: 200, message: "Channel Created", data: sanitizedChannel };
})
/**
 * PATCH /channels/:id
 * Body may contain any subset of: name, config, systemPrompt, isPublic, UIElements
 */
export const updateChannel = errorWrapper(async (req, res) => {
    const channel = await Channel.findOne({ _id: req.params.id, business: req.user.business });
    if (!channel) return { statusCode: 404, message: "Channel not found", data: null };

    // ──────────────────────────────────────────────────────────────
    // 1. Hot-update simple fields up-front
    // ──────────────────────────────────────────────────────────────
    const { name, systemPrompt, isPublic, UIElements } = req.body;
    if (name !== undefined) channel.name = name;
    if (systemPrompt !== undefined) channel.systemPrompt = systemPrompt;
    if (isPublic !== undefined) channel.isPublic = isPublic;
    if (UIElements !== undefined) channel.UIElements = UIElements;

    // ──────────────────────────────────────────────────────────────
    // 2. Handle provider-specific re-configuration if `config` sent
    // ──────────────────────────────────────────────────────────────
    if (req.body.config) {
        const newConfig = req.body.config;
        switch (channel.type) {
            case "email":
                const { host, port, secure, fromName, defaultRecipients: { to: [], cc: [], bcc: [], }, authType, user, pass, service, clientId, clientSecret, refreshToken, accessToken, expires } = config;
                let mailConfig
                channel.config = { host, port, secure, service, fromName, defaultRecipients, verified: false, lastVerifiedAt: new Date() }
                channel.secrets = { authType, user, pass, clientId, clientSecret, refreshToken, accessToken, expires }
                if (authType === "login") mailConfig = { host, port, secure, auth: { user, pass } }
                else if (authType === "oauth2") mailConfig = { service, auth: { type: "OAuth2", user, clientId, clientSecret, refreshToken } }
                const { success } = await verifyTransporter(mailConfig)
                if (!success) {
                    await channel.updateStatus("failed")
                    return { statusCode: 400, message: "transporter verification failed", data: null }
                }
                await channel.save()
                await channel.updateStatus("success")
                break;
            case "telegram":
                const { telegramToken } = newConfig;
                if (!telegramToken) break;            // nothing to change

                // re-initialise bot with new token
                const bot = new Telegraf(telegramToken);
                try {
                    const botInfo = await bot.telegram.getMe();
                    const webhookUrl = `${process.env.SERVER_URL}webhook/telegram/${botInfo.id}`;

                    // Set webhook to new URL
                    await bot.telegram.setWebhook(webhookUrl);
                    channel.config = { ...botInfo, url: `https://t.me/${botInfo.username}` }
                    channel.secrets = { botToken: telegramToken };
                    channel.webhookUrl = webhookUrl;
                    channel.status = "bot webhook updated";
                } catch (err) {
                    console.error(err);
                    return { statusCode: 401, message: "Invalid/new Telegram token", data: err };
                }
                break;

            case "whatsapp":
                const { whatsappCode, phone_number_id, waba_id, business_id } = newConfig;
                if (!whatsappCode) break;             // nothing to change

                const API_VERSION = "v23.0";
                try {
                    const { data } = await axios.get(
                        `https://graph.facebook.com/v21.0/oauth/access_token` +
                        `?client_id=${process.env.WA_CLIENT_ID}` +
                        `&client_secret=${process.env.WA_CLIENT_SECRET}` +
                        `&code=${whatsappCode}`
                    );

                    channel.secrets = {
                        permanentAccessToken: data.access_token,
                        phoneNumberPin: Math.floor(Math.random() * 900000) + 100000,
                        verificationToken: randomBytes(9).toString("hex")
                    };

                    const webhookUrl = `${process.env.SERVER_URL}webhook/whatsapp/${channel._id}`;
                    channel.webhookUrl = webhookUrl;
                    channel.config = { phone_number_id, waba_id, business_id };
                    channel.status = "fetched new access token";
                    await channel.save();

                    // Update webhook on WA side
                    await axios.post(
                        `https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`,
                        {
                            override_callback_uri: webhookUrl,
                            verify_token: channel.secrets.verificationToken
                        },
                        { headers: { Authorization: `Bearer ${channel.secrets.permanentAccessToken}` } }
                    );

                    // Re-register phone number
                    await axios.post(
                        `https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`,
                        { messaging_product: "whatsapp", pin: channel.secrets.phoneNumberPin },
                        { headers: { Authorization: `Bearer ${channel.secrets.permanentAccessToken}` } }
                    );

                    channel.status = "whatsapp webhook & registration updated";
                } catch (err) {
                    console.error(err);
                    return { statusCode: 401, message: "WhatsApp re-configuration failed", data: err };
                }
                break;


            /* other providers (web / phone / sms / email / instagram) can go here */
            default:
                break;
        }
    }

    await channel.save();
    return { statusCode: 200, message: "Channel Updated", data: channel };
});

/**
 * DELETE /channels/:id
 * Removes the channel and cleans up provider resources.
 */
export const deleteChannel = errorWrapper(async (req, res) => {
    const [channel, affected] = await Promise.all([
        Channel.findOne({ _id: req.params.id, business: req.user.business }),
        AgentModel.find({ channels: req.params.id, business: req.user.business }, "_id")
    ]);
    if (!channel) return { statusCode: 404, message: "Channel not found", data: null };
    try {
        switch (channel.type) {
            case "telegram": {
                const bot = new Telegraf(channel.secrets?.botToken);
                try {
                    await bot.telegram.deleteWebhook();          // remove webhook
                } catch (err) {
                    console.warn("Telegram webhook deletion failed; continuing.", err.message);
                }
                break;
            }
            case "whatsapp": {
                const { waba_id, phone_number_id } = channel.config ?? {};
                const API_VERSION = "v23.0";
                const token = channel.secrets?.permanentAccessToken;
                if (token && waba_id) {
                    try {
                        await axios.delete(
                            `https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } catch (err) {
                        console.warn("WA unsubscribe failed; continuing.", err.message);
                    }
                }
                if (token && phone_number_id) {
                    try {
                        await axios.post(
                            `https://graph.facebook.com/${API_VERSION}/${phone_number_id}/deregister`,
                            { messaging_product: "whatsapp" },
                            { headers: { Authorization: `Bearer ${token}` } }
                        );
                    } catch (err) {
                        console.warn("WA deregister failed; continuing.", err.message);
                    }
                }
                break;
            }
            /* Add teardown for other channel types as needed */
            default:
                break;
        }
    } catch (err) {
        console.error("Provider clean-up threw:", err);
    }
    await Promise.all([
        Channel.findByIdAndDelete(req.params.id),
        AgentModel.updateMany({ channels: req.params.id, business: req.user.business }, { $pull: { channels: req.params.id } })
    ]);
    const updatedAgents = await AgentModel.find({ _id: { $in: affected.map(a => a._id) } });
    return { statusCode: 200, message: "Channel deleted", data: { updatedAgents } };
});