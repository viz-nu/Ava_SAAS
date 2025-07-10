import { AgentModel } from "../models/Agent.js";
import { Channel } from "../models/Channels.js";

export const getBotDetails = async ({ type, botId }) => {
    try {
        switch (type) {
            case "telegram":
                const channelDetails = await Channel.findOne({ "config.id": botId })
                const agentDetails = await AgentModel.findOne({ "channel": channelDetails._id }).populate("business actions")
                console.log({ agentDetails, channelDetails });
                
                return { agentDetails, channelDetails }
            default:
                break;
        }


    } catch (error) {
        console.log(error);
        return null
    }
}
export const categorizeTelegramTrigger = (update) => {
    if (update.message) {
        const msg = update.message;
        if (msg.text) return (msg.text.startsWith('/')) ? 'command' : 'text_message';
        if (msg.photo) return 'photo';
        if (msg.video) return 'video';
        if (msg.document) return 'document';
        if (msg.voice) return 'voice';
        if (msg.audio) return 'audio';
        if (msg.sticker) return 'sticker';
        if (msg.contact) return 'contact';
        if (msg.location) return 'location';
        if (msg.new_chat_members) return 'new_chat_members';
        if (msg.left_chat_member) return 'left_chat_member';
        return 'other_message';
    }

    if (update.edited_message) return 'edited_message';
    if (update.callback_query) return 'callback_query';
    if (update.inline_query) return 'inline_query';
    if (update.chat_join_request) return 'chat_join_request';
    if (update.my_chat_member) return 'my_chat_member';
    if (update.chat_member) return 'chat_member';

    return 'unknown';
}
