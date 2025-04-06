import { Router } from "express";
import { parse } from "url";
export const whatsappRouter = Router()
whatsappRouter.get('/:params', async (req, res) => {
    try {
        const parsedUrl = parse(req.originalUrl, true);
        const query = parsedUrl.query;
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];
        console.log("Mode:", mode);
        console.log("Verify Token:", token);
        console.log("Challenge:", challenge);
        console.log("Params:", req.params);
        console.log("Query:", query);
        // Optional: Verify the token before responding
        if (mode === 'subscribe' && token === process.env.META_VERIFICATION_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            return res.status(200).send(challenge);
        } else {
            return res.sendStatus(403);
        }
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
});
whatsappRouter.post('/:params', async (req, res) => {
    try {

        // const mode = req.query['hub.mode'];
        // const token = req.query['hub.verify_token'];
        // const challenge = req.query['hub.challenge'];
        // console.log({ mode, token, challenge });
        const parsedUrl = parse(req.originalUrl, true);
        const query = parsedUrl.query;
        console.log("params", req.params);
        console.log("QUERY", query);
        console.log("body", req.body)
        return res.status(200);
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
})