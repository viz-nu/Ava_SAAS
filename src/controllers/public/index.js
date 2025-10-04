import axios from "axios";
import { errorWrapper } from "../../middleware/errorWrapper.js";
export const demoCall = errorWrapper(async (req, res) => {
    const { phoneNumber } = req.body;
    const channelId = "68cfc59094a23b31516a9db9", agentId = "68da93cd0c3694119ebdc4ac", PreContext = ""
    try {
        await axios.post(`https://app.avakado.ai/graphql/`, {
            query: `mutation Mutation($channelId: ID!, $to: String!, $agentId: ID!, $preContext: String) {
            makeTwilioAIOutboundCall(channelId: $channelId, to: $to, agentId: $agentId, PreContext: $preContext) 
        }`,
            variables: {
                "channelId": channelId,
                "to": phoneNumber,
                "agentId": agentId,
                "preContext": PreContext
            }
        },
            {
                headers: {
                    Authorization: `Bearer ${process.env.avakadoAccessKey}`,
                    'Content-Type': 'application/json'
                }
            })
        console.log("Call initiated successfully")
        return { statusCode: 200, message: "Demo call", data: "Demo call" }
    } catch (error) {
        console.error("Error initiating call:", error.response?.data || error.message)
        return { statusCode: 500, message: "Error initiating call", data: error.response?.data || error.message }
    }
})