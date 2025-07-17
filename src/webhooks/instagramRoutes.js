import { Router } from "express";
import { parse } from "url";
import { verifyRequestSignature } from "../utils/instagramHelper.js";
// import { getMediaTranscriptions, WhatsAppBot } from "../utils/WA.js";
// import { Conversation } from "../models/Conversations.js";
// import { Message } from "../models/Messages.js";
// import { createToolWrapper, knowledgeToolBaker } from "../utils/tools.js";
// import { Agent, run, RunState, tool } from "@openai/agents";
// import { Channel } from "../models/Channels.js";
// import { getBotDetails } from "../utils/telegraf.js";
// import { z } from "zod";
export const InstagramRouter = Router()

InstagramRouter.get("/main", async (req, res) => {
    try {
        const parsedUrl = parse(req.originalUrl, true);
        const query = parsedUrl.query;
        return (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === "LeanOn") ? res.status(200).send(query['hub.challenge']) : res.sendStatus(403);
    } catch (error) {
        console.error('Error in webhook verification:', error);
        return res.sendStatus(500);
    }
})
InstagramRouter.post("/main", verifyRequestSignature, async (req, res) => {
    try {
        // console.log("📨 Body:", JSON.stringify(req.body, null, 2));
        const parsedData = parseWebhook(req.body);
        console.log("📨 Parsed Data:", JSON.stringify(parsedData, null, 2));
        // https://developers.facebook.com/docs/instagram-platform/webhooks
        //  📨 Body: {
        //             "object": "instagram",
        //                 "entry": [
        //                     {
        //                         "time": 1752779559264,
        //                         "id": "17841476263120799",
        //                         "messaging": [
        //                             {
        //                                 "sender": {
        //                                     "id": "3667808733353751"
        //                                 },
        //                                 "recipient": {
        //                                     "id": "17841476263120799"
        //                                 },
        //                                 "timestamp": 1752779557528,
        //                                 "message": {
        //                                     "mid": "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDc2MjYzMTIwNzk5OjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTg1MTY2NDE4MDgwOTA5MzozMjMzMzA3NTkxNTM1NDMwNzQ0MTgzNzQyNzk3MzQyMzEwNAZDZD",
        //                                     "text": "Hey"
        //                                 }
        //                             }
        //                         ]
        //                     }
        //                 ]
        //         }

        https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api
        return res.sendStatus(200);
    } catch (error) {
        console.error('❌ Error in WhatsApp webhook:', error);
        return res.sendStatus(500);
    }
})
