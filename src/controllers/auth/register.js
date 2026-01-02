import axios from "axios";
import 'dotenv/config'
import { errorWrapper } from "../../middleware/errorWrapper.js";
import { User } from "../../models/User.js";
import { getBusinessInfo } from "../../utils/serpAPI.js";
export const OrgNameSuggestion = errorWrapper(async (req, res, next) => {
    const { query } = req.query
    const { data } = await axios.get(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${query}`, {
        "origin": "https://auth0.com",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    })
    return { statusCode: 200, message: "Organization name suggestions", data }
})
export const emailConformation = errorWrapper(async (req, res) => {
    const { code } = req.query
    const user = await User.findOneAndUpdate({ emailToken: code }, { isVerified: true }, { new: true })
    if (!user) return { statusCode: 404, message: "User not found" }
    return { statusCode: 303, message: "Email confirmed successfully", url: `${process.env.CLIENT_URL}login` }
})
export const OrgInfo = errorWrapper(async (req, res) => {
    return { statusCode: 200, message: "Organization info", data: await getBusinessInfo(req.params.name) }
})