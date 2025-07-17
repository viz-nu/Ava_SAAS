import { Types } from 'mongoose';
import { Template } from '../../models/market.js';
import { errorWrapper } from '../../middleware/errorWrapper.js';

/* ───────────────────────────── CREATE ───────────────────────────── */
// post 
export const createTemplate = errorWrapper(async (req, res) => {
    const { type, name, data } = req.body;
    if (!['agent', 'action'].includes(type)) return { statusCode: 400, message: `Invalid type`, data: type };

    // Check if template with same name already exists for same type
    const existingTemplate = await Template.findOne({ name, type });
    if (existingTemplate) return { statusCode: 400, message: `Template with name "${req.body.name}" already exists`, data: req.body };
    // Validate action references if type = agent
    if (type === 'agent' && Array.isArray(data?.actions) && data.actions.length > 0) {
        for await (const stdActionsId of data.actions) {
            const stdAction = await Template.findById(stdActionsId);
            if (!stdAction || stdAction.type !== "action") return { statusCode: 400, message: `Invalid or non-action template ID "${stdActionsId}"`, data: stdActionsId };
        }
    }
    const template = await Template.create({ ...req.body, createdBy: req.user._id });
    return { statusCode: 200, message: 'standard template created successfully', data: template };
});


/* ───────────────────────────── READ ROUTES ───────────────────────────── */
export const fetchTemplates = errorWrapper(async (req, res) => {
    const { type, status, createdBy, isPublic, isFeatured, page = 1, limit = 10, id, queryStr } = req.query;

    const filter = {};
    // Basic filters
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;
    if (id && Types.ObjectId.isValid(id)) filter._id = id;
    if (isPublic !== undefined) filter.isPublic = isPublic === 'true';
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
    // Text search
    if (queryStr) filter.$or = [{ name: { $regex: queryStr, $options: 'i' } }, { description: { $regex: queryStr, $options: 'i' } }, { 'data.personalInfo.name': { $regex: queryStr, $options: 'i' } },];
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const templates = await Template.find(filter).populate('createdBy', 'name email').populate('data.actions', 'name').populate('data.collections', 'name').skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 });
    const total = await Template.countDocuments(filter);
    return { statusCode: 200, message: 'Templates fetched successfully', data: templates, metaData: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
});


/* ───────────────────────────── UPDATE ROUTES ───────────────────────────── */
// PUT 
// Update template by ID
/* ───────────────────────────── UPDATE ROUTES ───────────────────────────── */
export const updateTemplate = errorWrapper(async (req, res) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, message: 'Invalid template ID', data: id };
    const existingTemplate = await Template.findById(id);
    if (!existingTemplate) return { statusCode: 404, message: 'Template not found', data: id };
    // Validate action references if updating an agent template
    if (req.body.type === 'agent' && Array.isArray(req.body?.data?.actions)) {
        for await (const stdActionsId of req.body.data.actions) {
            const stdAction = await Template.findById(stdActionsId);
            if (!stdAction || stdAction.type !== "action") return { statusCode: 400, message: `Invalid or non-action template ID "${stdActionsId}"`, data: stdActionsId };
        }
    }
    const template = await Template.findByIdAndUpdate(id, { ...req.body, createdBy: req.user._id }, { new: true, runValidators: true }).populate('createdBy', 'name email').populate('data.actions', 'name').populate('data.collections', 'name');
    return { statusCode: 200, message: 'Template updated successfully', data: template };
});


// Partial update template by ID
// Patch
export const partialUpdateTemplate = errorWrapper(async (req, res) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, message: 'Invalid template ID', data: id };
    const template = await Template.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true }).populate('createdBy', 'name email').populate('data.actions', 'name').populate('data.collections', 'name');
    if (!template) return { statusCode: 404, message: 'Template not found', data: id };
    return { statusCode: 200, message: 'Template updated successfully', data: template };
});

/* ───────────────────────────── DELETE ROUTES ───────────────────────────── */
// Delete template by ID
// delete
export const deleteTemplate = errorWrapper(async (req, res) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, message: 'Invalid template ID', data: id };
    const template = await Template.findByIdAndDelete(id);
    if (!template) return { statusCode: 400, message: 'Template not found', data: id };
    return { statusCode: 200, message: 'Template deleted successfully', data: template }
});