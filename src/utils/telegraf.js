import { AgentModel } from "../models/Agent.js";

export const getBotDetails = async (botId) => {
    try {
        const agent = await AgentModel.findOne({ "integrations.telegram.id": botId })
        return agent.toObject()
    } catch (error) {
        console.log(error);
        return null
    }
}