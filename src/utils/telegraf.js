import { Agent } from "../models/Agent.js";

export const getBotDetails = async (botId) => {
    try {
        const agent = await Agent.findOne({ "integrations.telegram.id": botId })
        return agent.toObject()
    } catch (error) {
        console.log(error);
        return null
    }
}