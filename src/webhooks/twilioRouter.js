import { Router, urlencoded } from "express";
import twilio from "twilio";
export const twilioRouter = Router()
const { SERVER_URL, TWILIO_AUTH_TOKEN } = process.env;
const validationMiddleware = async (req, res, next) => {
    try {
        const twilioSignature = req.headers['x-twilio-signature'];
        url = `${SERVER_URL}webhook/twilio/sms/status`
        const params = req.body;                     // POST parameters from Twilio
        // Validate the request
        const isValid = twilio.validateRequest(
            TWILIO_AUTH_TOKEN,
            twilioSignature,
            url,
            req.body
        );
        if (!isValid) return res.status(403).send('Forbidden');
        next();
    } catch (error) {
        console.error("webhook middleware validation failed", error);
        res.status(500).json({ msg: "internal server error" });
    }
}
twilioRouter.post('/sms/status', urlencoded({ extended: false }), validationMiddleware, async (req, res) => {
    try {
        // console.log("twilio sms status update", JSON.stringify(req.body, null, 2));
        return res.status(200).send("Success");
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
twilioRouter.post('/call/status', urlencoded({ extended: false }), validationMiddleware, async (req, res) => {
    try {
        // console.log("twilio call status update", JSON.stringify(req.body, null, 2));
        return res.status(200).send("Success");
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
