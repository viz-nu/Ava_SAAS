import nodemailer from "nodemailer";
export class EmailService {
    async verifyEmailTransporter(config) {
        try {
            const transporter = nodemailer.createTransport(config)
            await transporter.verify();
            return { success: true }
        } catch (error) {
            console.error(error)
            return { success: false }
        }
    }
}