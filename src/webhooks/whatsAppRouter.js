import { Router } from "express";
export const whatsappRouter = Router()
whatsappRouter.get('/:phoneNumber', async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        console.log("Mode:", mode);
        console.log("Verify Token:", token);
        console.log("Challenge:", challenge);
        console.log("Params:", req.params);
        console.log("Query:", req.query);
        console.log("Body:", req.body);

        // Optional: Verify the token before responding
        const VERIFY_TOKEN = process.env.META_VERIFICATION_TOKEN;
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
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

        console.log("params", req.params);
        console.log("QUERY", req.query);
        console.log("body", req.body)
        return res.status(200);
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
})