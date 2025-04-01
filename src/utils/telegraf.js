import { Agent } from "../models/Agent.js";

export const getBotDetails = async (botId) => {
    try {
        const agent = await Agent.findOne({ "personalInfo.telegram.id": botId })
        return agent
    } catch (error) {
        console.log(error);
        return null
    }
}