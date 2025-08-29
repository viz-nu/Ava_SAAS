import { Router, urlencoded } from "express";
import twilio from "twilio";
import { Conversation } from "../models/Conversations.js";
export const twilioRouter = Router();
const { TWILIO_AUTH_TOKEN } = process.env;
function absoluteUrl(req) {
    const proto = (req.headers["x-forwarded-proto"] || req.protocol);
    const host = (req.headers["x-forwarded-host"] || req.get("host"));
    return `${proto}://${host}${req.originalUrl}`; // includes query string
}

function validateTwilio(req, res, next) {
    try {
        if (!TWILIO_AUTH_TOKEN) {
            return res.status(500).send("Missing TWILIO_AUTH_TOKEN");
        }
        const signature = req.get("x-twilio-signature");
        const url = absoluteUrl(req);

        // For application/x-www-form-urlencoded (status callbacks), validateRequest is correct.
        const ok = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, req.body);
        if (!ok) return res.status(403).send("Forbidden");
        next();
    } catch (err) {
        console.error("Twilio validation failed", err);
        res.status(500).json({ msg: "internal server error" });
    }
}

// --- Routes ---------------------------------------------------------------
twilioRouter.post(
    "/sms/status",
    urlencoded({ extended: false }), // Twilio sends x-www-form-urlencoded
    validateTwilio,
    (req, res) => res.status(200).send("Success")
);

twilioRouter.post(
    "/call/status",
    urlencoded({ extended: false }),
    validateTwilio,
    async (req, res) => {
        console.log("twilio call status update", JSON.stringify(req.body, null, 2));
        const { CallSid, CallStatus, RecordingStatus } = req.body;
        const conversation = await Conversation.findOne({ voiceCallIdentifierNumberSID: CallSid });
        if (CallStatus) {
            if (conversation) {
                conversation.metadata.status = CallStatus;
                conversation.metadata.callDetails = req.body;
                if (CallStatus === "completed") await conversation.updateAnalytics();
            }
        }
        if (RecordingStatus === "completed") conversation.metadata.callDetails = { ...conversation.metadata.callDetails, recording: { ...req.body } };
        res.status(200).send("Success");
    }
);
