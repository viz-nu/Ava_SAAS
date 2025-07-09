import { AgentModel } from "../models/Agent.js";
import { Channel } from "../models/Channels.js";

export const getBotDetails = async ({ type, botId }) => {
    try {
        switch (type) {
            case "telegram":
                const channel = await Channel.findOne({ "config.id": botId }, "_id")
                const agent = await AgentModel.findOne({ "channel": channel._id })
                console.log({ channel, agent });
                return agent
            default:
                break;
        }


    } catch (error) {
        console.log(error);
        return null
    }
}