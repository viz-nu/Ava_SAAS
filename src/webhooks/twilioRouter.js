import { Router, urlencoded } from "express";
import twilio from "twilio";
export const twilioRouter = Router()
const { SERVER_URL, TWILIO_AUTH_TOKEN } = process.env;
twilioRouter.post('/sms/status', urlencoded({ extended: false }), async (req, res, next) => {
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
    }
}, async (req, res) => {
    try {
        // console.log(JSON.stringify(req.body, null, 2));
        // {
        //     "ApiVersion": "2010-04-01",
        //         "MessageStatus": "sent",
        //             "SmsSid": "SM3eab196XXXXXXXXXXXXXeceaa93",
        //                 "SmsStatus": "sent",
        //                     "To": "+919DDDDD639",
        //                         "From": "+198DDDDDD02",
        //                             "MessageSid": "SM3eab196XXXXXXXXXXXXXeceaa93",
        //                                 "AccountSid": "AC0ddXXXXXXXXXXXXXfa912"
        // }
        // {
        //     "ApiVersion": "2010-04-01",
        //         "MessageStatus": "delivered",
        //             "RawDlrDoneDate": "2508242137",
        //                 "SmsSid": "SM3eab196XXXXXXXXXXXXXeceaa93",
        //                     "SmsStatus": "delivered",
        //                         "To": "+919DDDDD639",
        //                             "From": "+198DDDDDD02",
        //                                 "MessageSid": "SM3eab196XXXXXXXXXXXXXeceaa93",
        //                                     "AccountSid": "AC0ddXXXXXXXXXXXXXfa912"
        // }
        console.warn(`SMS SID: ${CallSid}, Status: ${CallStatus}`);
        res.status(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
twilioRouter.post('/call/status', urlencoded({ extended: false }), async (req, res) => {
    try {
        console.log("twilio webhook body: ", JSON.stringify(req.body, null, 2));
        // find in converation by CallSid as  voiceCallIdentifierNumberSID and update metadata.callDetails
        console.warn(`CALL SID: ${CallSid}, Status: ${CallStatus}`);
        res.status(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
