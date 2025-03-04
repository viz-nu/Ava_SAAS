import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Business } from "../../models/Business.js";
import { sendMail } from "../../utils/sendEmail.js";
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

export const raiseTicket = errorWrapper(async (req, res) => {
    const { issueDetails, attachments } = req.body;
    if (!issueDetails) return res.status(400).json({ success: false, message: "Client email, supporter email, and issue details are required." });
    // Generate a well-structured subject, text message, and HTML
    const subject = `🚀 Support Ticket Raised by ${req.user.email}`;
    const message = `Dear Support Team, \n\nA new support ticket has been raised by ${req.user.email}. \n\nIssue Details:\n${issueDetails}\n\nPlease assist as soon as possible.\n\nBest regards,\nSupport System`;
    const htmlMessage = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
                <h2 style="color: #007bff;">New Support Ticket Raised</h2>
                <p><strong>Issue Details:</strong></p>
                <blockquote style="background: #f8f9fa; padding: 10px; border-left: 4px solid #007bff;">
                    ${issueDetails}
                </blockquote>
                <p>Please review and assist as soon as possible.</p>
                <p>Best Regards,</p>
                <p><strong>Support System</strong></p>
            </div>
        `;
    const emailData = {
        to: "ankit@onewindow.co,vishnu.teja101.vt@gmail.com",
        subject,
        text: message,
        html: htmlMessage,
        attachments: attachments || [],
    };
    const clientSubject = `✅ Your Support Request Has Been Received`;
    const clientMessage = `Dear ${req.user.name},\n\nWe have received your support request and our team will get back to you shortly.\n\nIssue Details:\n${issueDetails}\n\nIf you need to add any more information, feel free to reply to this email.\n\nBest Regards,\nSupport Team`;
    const clientHtmlMessage = `
    <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
        <h2 style="color: #28a745;">✅ Support Request Received</h2>
        <p>Dear ${req.user.name},</p>
        <p>We have received your support request and our team will get back to you shortly.</p>
        <p><strong>Issue Details:</strong></p>
        <blockquote style="background: #f8f9fa; padding: 10px; border-left: 4px solid #28a745;">
            ${issueDetails}
        </blockquote>
        <p>If you need to add any more information, feel free to reply to ankit@onewindow.co.</p>
        <p>Best Regards,</p>
        <p><strong>Support Team</strong></p>
    </div>
`;
    const clientEmailData = {
        to: req.user.email,
        subject: clientSubject,
        text: clientMessage,
        html: clientHtmlMessage,
    };
    await Promise.all([sendMail(emailData), sendMail(clientEmailData)])
    return { statusCode: 200, message: "Ticket raised successfully", data: null }
});
