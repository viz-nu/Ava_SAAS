import { Router } from "express";
import xssReqSanitizer from "xss-req-sanitizer";
import { firecrawlRouter } from "./firecrawlRouter.js";
import { telegramRouter } from "./telegramRouter.js";
export const webhookRouter = Router();
webhookRouter.use(xssReqSanitizer())
webhookRouter.use("/firecrawl", firecrawlRouter);
webhookRouter.use("/telegram", telegramRouter);