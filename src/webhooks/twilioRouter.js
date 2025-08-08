import { Router, urlencoded } from "express";
export const twilioRouter = Router()
twilioRouter.post('/sms/status', urlencoded({ extended: false }), async (req, res) => {
    try {
        const { MessageSid, MessageStatus } = req.body
        console.log(JSON.stringify(req.body, null, 2));
        console.warn(`SMS SID: ${MessageSid}, Status: ${MessageStatus}`);
        res.status(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
