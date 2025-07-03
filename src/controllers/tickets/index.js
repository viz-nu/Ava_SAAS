import { errorWrapper } from "../../middleware/errorWrapper.js";
import { updateTicketSchema } from "../../Schema/index.js"
import { Ticket } from "../../models/Tickets.js";
import { Channel } from "../../models/Channels.js";
import { sendEmail } from "../../utils/sendEmail.js";

// // ---------- list with filters ----------
// const filter = buildFilters(req.query);
// const { page, limit } = parsePagination(req.query);
// const sort = parseSort(req.query);

// const buildFilters = ({ channel, status, priority }) => {
//     const filter = {};
//     if (channel) filter.channel = channel;
//     if (status) filter.status = status;
//     if (priority) filter.priority = priority;
//     return filter;
// };

// const parsePagination = ({ page = 1, limit = 20 }) => ({
//     page: Math.max(parseInt(page, 10), 1),
//     limit: Math.min(Math.max(parseInt(limit, 10), 1), 100)
// });

// const parseSort = ({ sortBy = 'createdAt', sortOrder = 'desc' }) => ({
//     [sortBy]: sortOrder === 'asc' ? 1 : -1
// })

// get    /:id?
export const fetchTickets = errorWrapper(async (req, res) => {
    const { channel, status, priority, sortBy = 'createdAt', sortOrder = 'desc' } = req.query
    const filter = { business: req.user.business }
    if (channel) filter.channel = channel;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (req.params.id) filter._id = req.params.id;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    const parsePagination = ({ page = 1, limit = 20 }) => ({ page: Math.max(parseInt(page, 10), 1), limit: Math.min(Math.max(parseInt(limit, 10), 1), 100) });
    const { page, limit } = parsePagination(req.query);
    const [tickets, total] = await Promise.all([
        Ticket.find(filter)
            .populate('business')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit),
        Ticket.countDocuments(filter)
    ]);
    return { statusCode: 200, message: `ticket${req.params.id ? "" : "s"} fetched successfully`, data: tickets, metaData: { page, limit, totalPages: Math.ceil(total / limit), total } }
});
// patch    /:id
export const updateTicket = errorWrapper(async (req, res) => {
    const ticket = await Ticket.findOne({ business: req.user.business, _id: req.params.id })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const parsed = updateTicketSchema.parse(req.body);
    const channel = await Channel.findOne({ business: req.user.business, _id: parsed.response.channelId })
    if (!channel) return res.status(404).json({ error: 'channel not found' });
    switch (parsed.status) {
        case "responded":
            switch (ticket.channel) {
                case "web":
                    let mailConfig = {}, mailData = {}
                    if (channel.secrets.authType === "login") {
                        mailConfig = {
                            host: channel.config.host,
                            port: channel.config.port,
                            secure: channel.config.secure,
                            auth: {
                                user: channel.secrets.user,
                                pass: channel.secrets.pass
                            }
                        }
                    }
                    else if (channel.secrets.authType === "oauth2") {
                        mailConfig = {
                            service: channel.config.service,
                            auth: {
                                clientId: channel.secrets.clientId,
                                clientSecret: channel.secrets.clientSecret,
                                refreshToken: channel.secrets.refreshToken,
                                user: channel.secrets.user
                            }
                        }
                    }
                    const { from, to, cc, bcc, subject, text, html } = parsed.response;
                    ticket.response = { channelId: channel._id, from, to, cc, subject, bcc, text, html, updatedAt: new Date(), sentAt: new Date() }
                    mailData = { from, to, cc, bcc, subject, text, html, attachments }
                    const EmailResp = await sendEmail({ config: mailConfig, emailData: mailData })
                    if (!EmailResp.status) return { statusCode: 500, message: "email not sent", data: EmailResp }
                    await ticket.save()
                    break;
                default:
                    break;
            }
            break;
        case "resolved":
            await ticket.markResolved()
            break;
        default:
            break;
    }
    return { statusCode: 200, message: `ticket updated successfully`, data: ticket }
});
export const deleteTicket = errorWrapper(async (req, res) => {
    const ticket = await Ticket.findOne({ business: req.user.business, _id: req.params.id })
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    await Ticket.findByIdAndDelete(req.params.id);
    return { statusCode: 200, message: `ticket deleted successfully`, data: null }
});



