import { Router, urlencoded } from "express";
export const twilioRouter = Router()
twilioRouter.post('/sms/status', urlencoded({ extended: false }), async (req, res) => {
    try {
        // const isValid = validateRequest(
        //     TWILIO_AUTH_TOKEN,
        //     twilioSignature,
        //     url,
        //     request.body
        // );
        const { MessageSid, MessageStatus } = req.body
        console.log(JSON.stringify(req.body, null, 2));
        console.warn(`SMS SID: ${MessageSid}, Status: ${MessageStatus}`);
        res.status(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
twilioRouter.post('/call/status', urlencoded({ extended: false }), async (req, res) => {
    try {
        const {
            CallSid,
            CallStatus,
            From,
            To,
            Direction,
            Duration,
            CallDuration,
            RecordingUrl,
            Timestamp
        } = request.body;
        console.log("twilio webhook body: ",JSON.stringify(req.body, null, 2));
        // find in converation by CallSid as  voiceCallIdentifierNumberSID and update metadata.callDetails
        console.warn(`CALL SID: ${CallSid}, Status: ${CallStatus}`);
        res.status(200)
    } catch (error) {
        console.log(error);
        res.status(500).json({ msg: "internal server error" });
    }
});
