import { Router } from "express";
export const whatsappRouter = Router()
whatsappRouter.get('/:params', async (req, res) => {
    try {

        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        console.log({ mode, token, challenge });

        console.log("params", req.params);
        console.log("QUERY", req.query);
        console.log("body", req.body)
        return res.status(200).send(challenge);
    } catch (error) {
        console.error('Error in webhook verification:', error);
        res.sendStatus(500);
    }
})
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