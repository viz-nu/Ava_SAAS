import { Router } from "express";
import xssReqSanitizer from "xss-req-sanitizer";
import { firecrawlRouter } from "./firecrawlRouter.js";
export const webhookRouter = Router();
webhookRouter.use(xssReqSanitizer())
webhookRouter.use("/firecrawl", firecrawlRouter);