import axios from "axios";
import { errorWrapper } from "../../middleware/errorWrapper.js";
export const demoCall = errorWrapper(async (req, res) => {
    const { phoneNumber, PreContext = "" } = req.body;
    const channelId = "69299acfc5b3e1f390a10d59"
    try {
        await axios.post(`https://app.avakado.ai/graphql/`, {
            query: `mutation MakeAnOutboundCall($channelId: ID!, $number: String, $preContext: String) {
            makeAnOutboundCall(channelId: $channelId, number: $number, PreContext: $preContext) 
        }`,
            variables: {
                "channelId": channelId,
                "number": phoneNumber,
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