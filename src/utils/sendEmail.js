import nodemailer from "nodemailer";
import 'dotenv/config';
let HOST = process.env.EMAIL_SMTP_HOST, AUTH = process.env.EMAIL_SMTP_AUTH, PASS = process.env.EMAIL_SMTP_PASS;

export const sendMail = async (emailData) => {
    let info
    try {
        let transporter = nodemailer.createTransport({
            host: HOST,
            port: 465,
            secure: true,
            auth: {
                user: AUTH,
                pass: PASS,
            },
        });
        let mailData = {
            from: `"AVA" <${AUTH}>`, // sender address
            to: emailData.to, // list of receivers
            subject: emailData.subject, // Subject line
        }
        if (emailData.attachments?.length > 0) mailData.attachments = emailData.attachments
        if (emailData.html) mailData.html = emailData.html
        if (emailData.text) mailData.text = emailData.text
        info = await transporter.sendMail(mailData);
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error(error);
        return { status: false, ...error }
    }
    finally {
        return {
            status: true,
            ...info
        }
    }
}
export const verifyTransporter = async (config) => {
    try {
        const transporter = nodemailer.createTransport(config)
        await transporter.verify();
        return { success: true }
    } catch (error) {
        console.error(error)
        return { success: false }
    }
}

export const sendEmail = async ({ config, emailData }) => {
    let info
    try {
        let transporter = nodemailer.createTransport(config);
        info = await transporter.sendMail(emailData);
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error(error);
        return { status: false, ...error }
    }
    finally {
        return {
            status: true,
            ...info
        }
    }
}