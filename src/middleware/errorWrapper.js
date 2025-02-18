/**  handles errors inside every req */
import { startSession } from "mongoose"
import { generateAPIError } from "../errors/apiError.js"
export const errorWrapper = (fn) => {
  return async (req, res, next) => {
    const session = await startSession();
    try {
      session.startTransaction();
      const result = await fn(req, res, next, session);
      if (result) {
        const { statusCode, message, data, url } = result;
        let obj = { success: true, message, data };
        if (req.AccessToken) obj.AccessToken = req.AccessToken;

        // 200s: Success Responses
        if (statusCode >= 200 && statusCode < 300) {
          await session.commitTransaction();
          return res.status(statusCode).json(obj);
        }
        // 300s: Redirection Responses
        if (statusCode >= 300 && statusCode < 400) {
          await session.commitTransaction();
          return res.redirect(url);
        }
        // 400s & 500s: Error Responses
        if (statusCode >= 400) {
          await session.abortTransaction();
          return next(generateAPIError(message, statusCode, data));
        }
      }
    } catch (error) {
      await session.abortTransaction();
      next(error);
    }
    finally {
      session.endSession();
    }
  };
};