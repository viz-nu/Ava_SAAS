import axios from "axios";
import 'dotenv/config'
import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { User } from "../../models/User.js";
import { sendMail } from "../../utils/sendEmail.js";
import { fileURLToPath } from "url";
import path from 'path';
import { readFileSync } from "fs";
import bcrypt from "bcryptjs";
import Handlebars from "handlebars";
import { createFolder } from "../../utils/CRMintegrations.js";
import { getBusinessInfo } from "../../utils/serpAPI.js";
export const register = errorWrapper(async (req, res, next) => {
    const { name, email, password, role, BusinessName, logoURL } = req.body;
    const newOrganization = await Business.create({ name: BusinessName, logoURL: logoURL })
    let emailToken = (Math.random() + 1).toString(16).substring(2);
    const user = await User.create({ email: email, password: bcrypt.hashSync(password, 12), role: role, name: name, business: newOrganization._id, isVerified: false, emailToken });
    newOrganization.createdBy = user._id
    const doc = await createFolder(newOrganization._id, process.env.DEFAULT_BUSINESS_FOLDER_ZOHO)
    newOrganization.docData = {
        folder: doc.id,
        name: doc.attributes.name,
        parent: doc.attributes.parent_id,
        download_url: doc.attributes.download_url,
        modified_by_zuid: doc.attributes.modified_by_zuid
    }
    await Promise.all([user.save(), newOrganization.save()])
    let subject = "	[AVA] Click this link to confirm your email address"
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(__dirname, '../../../static/emailVerification.html');
    const source = readFileSync(filePath, "utf-8").toString();
    const template = Handlebars.compile(source);
    let url = `${process.env.SERVER_URL}email/confirmation?code=${emailToken}`;
    const emailResponse = await sendMail({ to: email, subject, html: template({ url: url }) });
    if (!emailResponse.status) {
        await Promise.all([
            User.findByIdAndDelete(user._id),
            Business.findByIdAndDelete(newOrganization._id)
        ]);
        throw new Error("Failed to send verification email. Registration aborted.");
    }
    return { statusCode: 200, message: "Registration successful, Verify and Login" }
})
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