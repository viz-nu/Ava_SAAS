import { Router } from "express";
import xssReqSanitizer from "xss-req-sanitizer";
import { firecrawlRouter } from "./firecrawlRouter.js";
import { telegramRouter } from "./telegramRouter.js";
import { whatsappRouter } from "./whatsAppRouter.js";
export const webhookRouter = Router();
webhookRouter.use(xssReqSanitizer())
webhookRouter.use("/firecrawl", firecrawlRouter);
webhookRouter.use("/telegram", telegramRouter);
webhookRouter.use("/whatsapp", whatsappRouter);