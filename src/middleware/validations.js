
import { registerSchema } from "../Schema/index.js";
import { errorWrapper } from "./errorWrapper.js";
export const validateRegistration = errorWrapper(async (req, res, next) => {
    await registerSchema.validate(req.body, { abortEarly: false });
    next();
});
