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
import { ticketsRouter } from "./tickets.js";
import { SuperUserRouter } from "./SuperUser.js";

export const indexRouter = Router();
indexRouter.use(xssReqSanitizer())

// Authentication routes
indexRouter.use("/auth", authRouter);

// Public routes (no authentication required)
indexRouter.use("/public", publicRouter);

// Protected routes with scope-based authorization
indexRouter.use("/collection", collectionRouter);
indexRouter.use("/essentials", essentialsRouter)
indexRouter.use("/agent", AgentsRouter)
indexRouter.use("/admin", AdminRouter)
indexRouter.use("/channels", channelRouter)
indexRouter.use("/actions", actionsRouter)
indexRouter.use("/template", marketRouter)
indexRouter.use("/tickets", ticketsRouter)

// Super User routes (platform-level operations)
indexRouter.use("/super", SuperUserRouter)