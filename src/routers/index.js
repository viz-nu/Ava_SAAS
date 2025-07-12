import { Router } from "express";
import xssReqSanitizer from "xss-req-sanitizer";
import { authRouter } from "./auth.js";
import { publicRouter } from "./public.js";
import { collectionRouter } from "./collectionRouter.js";
import { essentialsRouter } from "./essentials.js";
import { AgentsRouter } from "./agent.js";
import { AdminRouter } from "./admin.js";
import { channelRouter } from "./channel.js";
import { actionsRouter } from "./actions.js";
import { marketRouter } from "./market.js";
export const indexRouter = Router();
indexRouter.use(xssReqSanitizer())
indexRouter.use("/auth", authRouter);
indexRouter.use("/public", publicRouter);
indexRouter.use("/collection", collectionRouter);
indexRouter.use("/essentials", essentialsRouter)
indexRouter.use("/agent", AgentsRouter)
indexRouter.use("/admin", AdminRouter)
indexRouter.use("/channels", channelRouter)
indexRouter.use("/actions", actionsRouter)
indexRouter.use("/template", marketRouter)