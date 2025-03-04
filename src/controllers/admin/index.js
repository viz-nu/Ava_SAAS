import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
export const Dashboard = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business).populate("agents collections members documents");
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    return { statusCode: 200, message: "Dashboard retrieved", data: { user: req.user, business: business } };
})
export const editBusiness = errorWrapper(async (req, res) => {
    let business = await Business.findById(req.user.business)
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const { logoURL, facts, sector, tagline, address, description, contact } = req.body
    if (logoURL) business.logoURL = logoURL;
    if (facts) business.facts = facts;
    if (sector) business.sector = sector;
    if (tagline) business.tagline = tagline;
    if (address) business.address = address;
    if (description) business.description = description;
    if (contact) business.contact = contact;
    await business.save();
    return { statusCode: 200, message: "Business updated", data: business }
});