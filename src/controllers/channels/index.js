import { Telegraf } from "telegraf";
import { Business } from "../../models/Business.js";
import { Channel } from "../../models/Channels.js";
const { wa_client_id, wa_client_secret, SERVER_URL } = process.env;
import axios from 'axios';
import { errorWrapper } from "../../middleware/errorWrapper.js";


export const fetchChannels = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business);
    if (!business) {
        return { statusCode: 404, message: "Business not found", data: null };
    }

    const { id, type, status } = req.query;

    // Validate and build filter
    const filter = { business: business._id };
    if (id) {
        if (!/^[a-f\d]{24}$/i.test(id)) {
            return { statusCode: 400, message: "Invalid channel ID format", data: null };
        }
        filter._id = id;
    }
    if (type) filter.type = type;
    if (status) filter.status = status;

    const channels = await Channel.find(filter).lean();
    return {
        statusCode: 200,
        message: `Channel${id ? '' : 's'} fetched`,
        data: id && channels.length === 1 ? channels[0] : channels
    };
});


export const createChannel = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    let { name, type, config, systemPrompt, isPublic, UIElements } = req.body;
    const channel = await Channel.create({ name, business: req.user.business, type, config, status: "initiated", systemPrompt, isPublic, UIElements })
    let webhookUrl
    switch (type) {
        case "telegram":
            const { telegramToken } = config
            const bot = new Telegraf(telegramToken);
            let botInfo
            channel.webhookUrl = `${process.env.SERVER_URL}webhook/telegram/${botInfo.id}`;
            try {
                botInfo = await bot.telegram.getMe(); // Fetch bot details 
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "invalid telegramToken", data: { telegramToken } };
            }
            channel.status = "fetched bot details"
            await channel.save()
            try {
                await bot.telegram.setWebhook(webhookUrl);
            } catch (error) {
                console.log(error);
                return { statusCode: 500, message: "Internal Server Error While Setting Up Telegram Webhook", data: null };
            }
            channel.status = "bot webhook set"
            config = { userName: botInfo.username, id: botInfo.id }
            secrets = { botToken: telegramToken }
            break;
        case "whatsapp":
            const { whatsappCode, phone_number_id, waba_id, business_id } = config
            const API_VERSION = 'v23.0';
            try {
                const { data } = await axios.get(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${wa_client_id}&client_secret=${wa_client_secret}&code=${whatsappCode}`);
                channel.status = "fetched access token"
                channel.secrets = { permanentAccessToken: data.access_token, phoneNumberPin: Math.floor(Math.random() * 900000) + 100000, verificationToken: randomBytes(9).toString('hex') }
                channel.webhookUrl = `${SERVER_URL}webhook/whatsapp/${agent._id}`
                channel.config = { phone_number_id, waba_id, business_id }
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "whatsapp code verification failed", data: error };
            }
            await channel.save()
            try {
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${waba_id}/subscribed_apps`, { "override_callback_uri": webhookUrl, "verify_token": channel.secrets.verificationToken }, { headers: { 'Authorization': `Bearer ${channel.secrets.permanentAccessToken}` } });
                channel.status = "bot webhook set"
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "whatsapp webhook verification failed", data: error };
            }
            await channel.save()
            try {
                await axios.post(`https://graph.facebook.com/${API_VERSION}/${phone_number_id}/register`, { 'messaging_product': 'whatsapp', 'pin': channel.secrets.phoneNumberPin }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${channel.secrets.permanentAccessToken}` } });
                channel.status = "bot messaging_product set"
            } catch (error) {
                console.log(error);
                return { statusCode: 401, message: "registering ", data: error };
            }
            break;
        case "web":
            break;
        case "phone":
            break;
        case "instagram":
            break;
        case "sms":
            break;
        case "email":
            break;
        default:
            break;
    }
    await channel.save()
    return { statusCode: 200, message: "Channel Updated", data: Channel };
})


/**
 * PATCH /channels/:id
 * Body may contain any subset of: name, config, systemPrompt, isPublic, UIElements
 */
export const updateChannel = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null };

    const channel = await Channel.findOne({ _id: req.params.id, business: business._id });
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
            case "telegram": {
                const { telegramToken } = newConfig;
                if (!telegramToken) break;            // nothing to change

                // re-initialise bot with new token
                const bot = new Telegraf(telegramToken);
                try {
                    const botInfo = await bot.telegram.getMe();
                    const webhookUrl = `${process.env.SERVER_URL}webhook/telegram/${botInfo.id}`;

                    // Set webhook to new URL
                    await bot.telegram.setWebhook(webhookUrl);

                    channel.config = { userName: botInfo.username, id: botInfo.id };
                    channel.secrets = { botToken: telegramToken };
                    channel.webhookUrl = webhookUrl;
                    channel.status = "bot webhook updated";
                } catch (err) {
                    console.error(err);
                    return { statusCode: 401, message: "Invalid/new Telegram token", data: err };
                }
                break;
            }

            case "whatsapp": {
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
            }

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
    const business = await Business.findById(req.user.business);
    if (!business) return { statusCode: 404, message: "Business not found", data: null };

    const channel = await Channel.findOne({ _id: req.params.id, business: business._id });
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

    // Finally remove the document
    await channel.deleteOne();
    return { statusCode: 200, message: "Channel deleted", data: { id: channel._id } };
});