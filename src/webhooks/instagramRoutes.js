import { Router } from "express";
import { parse } from "url";
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
InstagramRouter.post("/main", async (req, res) => {
    try {
        console.log("📨 Body:", JSON.stringify(req.body, null, 2));
        console.log({ params: req.params })
    } catch (error) {
        console.error('❌ Error in WhatsApp webhook:', error);
        return res.sendStatus(500);
    }
})
