import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
export const Dashboard = errorWrapper(async (req, res) => {

    const business = await Business.findById(req.user.business).populate("agents collections members documents");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return {
        statusCode: 200, message: "Dashboard retrieved", data: {
            user: req.user,
            business: business
        }
    };
})