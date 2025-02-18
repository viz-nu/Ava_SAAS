import { APIError } from "../errors/apiError.js";
// import mongoose from 'mongoose';
import { StatusCodes } from "http-status-codes";
import * as yup from "yup";
const errorHandlerMiddleware = (err, req, res, next) => {
    let customError = {
        statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        msg: err.message || "Something went wrong, try again later",
        data: err.data || null
    };

    // if (err instanceof mongoose.ValidationError) {
    //     customError.msg = "Database Validation failed"
    //     customError.data = Object.values(err.errors).map((item) => item.message)
    //     customError.statusCode = StatusCodes.BAD_REQUEST;
    // }
    if (err instanceof yup.ValidationError) {
        customError.msg = "Validation failed"
        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.data = err.inner.map(e => ({ field: e.path, message: e.message, value: e.value}));
    }

    if (err.code && err.code === 11000) {
        customError.msg = `Duplicate value entered for ${Object.keys(err.keyValue)} field, please choose another value`;
        customError.statusCode = StatusCodes.BAD_REQUEST;
    }

    if (err.name === "CastError") {
        customError.msg = `No item found with id: ${err.value}`;
        customError.statusCode = StatusCodes.NOT_FOUND;
    }

    return res.status(customError.statusCode).json({
        message: customError.msg,
        status: "failure",
        success: false,
        data: customError.data,
    });
};

export default errorHandlerMiddleware;
