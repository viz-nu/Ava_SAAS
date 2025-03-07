// import * as yup from "yup";
import { string, object, ValidationError, array, mixed, boolean } from "yup"
import { Business } from "../models/Business.js"
import { User } from "../models/User.js";
export const registerSchema = object({
    name: string().required(),
    email: string().email("Invalid email format").required("Email is required").test("is-not-disposable", "Invalid or disposable email", async (value) => {
        const [response, existingEmail] = await Promise.all([
            fetch(`https://disposable.debounce.io/?email=${value}`),
            User.findOne({ email: value })
        ])
        if (existingEmail) { throw new ValidationError("Email is already registered with us, talk to customer care for help", value, "email"); }
        const data = await response.json();
        if (data.disposable === "true") { throw new ValidationError("Please do not use throwaway emails", value, "email"); }
        if (data.success === "0") { throw new ValidationError("Invalid email ID", value, "email"); }
        return true;
    }),
    // phone: string().min(10).max(15).required(),
    password: string().min(8).max(16).required('Password is required').test("passwordCheck", "weak password", (value) => {
        let msg = [];
        if (!/[A-Z]/.test(value)) msg.push("does not contain upper case letter")
        if (!/[a-z]/.test(value)) msg.push("does not contain lower case letter")
        if (!/\d/.test(value)) msg.push("does not contain number")
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) msg.push("does not contain special character")
        if (msg.length > 0) throw new ValidationError(`${msg.join(", ")}`, value, "password")
        return true;
    }),
    role: string().oneOf(["admin", "manager"]).required(),
    BusinessName: string().required()
    // .test("unique-org", "Business name must be unique", async (value) => {
    //     const existingOrg = await Business.findOne({ name: value });
    //     if (!existingOrg) return true
    //     throw new ValidationError("Business is already registered with us, talk to customer care for help", value, "BusinessName");
    // })
});
export const collectionSchema = object({
    name: string().required("Name is required"),
    contents: array().of(
        object({
            source: string().oneOf(['website', 'youtube', 'file']).required("Should be one of the following 'website', 'youtube', 'file' "),
            metaData: mixed().notRequired()
        })
    ).optional()
});

export const updateSchema = object({
    action: string().oneOf(['rename', 'addContents', 'removeContents']).required(),
    name: string().optional(),
    addContents: array().of(
        object({
            source: string().oneOf(['website', 'youtube', 'file']).optional("Should be one of the following 'website', 'youtube', 'file' "),
            metaData: mixed().optional()
        })
    ).optional(),
    removeContentIds: array().optional()

});
import mongoose from 'mongoose';

const objectIdValidator = string().test('is-valid-objectId', 'Invalid ObjectId', (value) => mongoose.Types.ObjectId.isValid(value));
export const agentSchema = object({
    collections: array().of(objectIdValidator),
    appearance: object().optional(),
    personalInfo: object().optional(),
    actions: array().of(object()).optional(),
    // business: objectIdValidator.required('Business is required').optional(),
    // createdBy: objectIdValidator.required('CreatedBy is required').optional(),
    isPublic: boolean(),
    isFeatured: boolean(),
});
