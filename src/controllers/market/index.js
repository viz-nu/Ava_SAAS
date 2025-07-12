import { Types } from 'mongoose';
import { Template } from '../../models/market.js';

/* ───────────────────────────── CREATE ───────────────────────────── */
// post 
export const createTemplate = errorWrapper(async (req, res) => {
    const { type } = req.body;
    if (!type) return { statusCode: 400, message: `invalid type`, data: req.body };
    const template = await Template.create({ ...req.body, createdBy: req.user._id });
    return { statusCode: 200, message: 'standard template created successfully', data: template };
});


/* ───────────────────────────── READ ROUTES ───────────────────────────── */
// get 
export const fetchTemplates = errorWrapper(async (req, res) => {
    const { type, status, createdBy, isPublic, isFeatured, page = 1, limit = 10, id, queryStr } = req.query;
    // Build filter object
    const filter = queryStr ? {
        $or: [
            { name: { $regex: queryStr, $options: 'i' } },
            { 'config.personalInfo.name': { $regex: queryStr, $options: 'i' } },
            { 'config.name': { $regex: queryStr, $options: 'i' } },
            { 'config.description': { $regex: queryStr, $options: 'i' } }
        ]
    } : {}
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (createdBy) filter.createdBy = createdBy;
    if (id && Types.ObjectId.isValid(id)) filter._id = id
    // if (isPublic !== undefined) filter['config.isPublic'] = isPublic === 'true';
    // if (isFeatured !== undefined) filter['config.isFeatured'] = isFeatured === 'true';

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const templates = await Template.find(filter)
        .populate('createdBy', 'name email')
        .populate('config.business', 'name')
        .populate('config.collections', 'name')
        .populate('config.channels', 'name')
        .populate('config.actions', 'name')
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });

    const total = await Template.countDocuments(filter);
    return { statusCode: 200, message: 'standard template fetched successfully', data: templates, metaData: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
});

/* ───────────────────────────── UPDATE ROUTES ───────────────────────────── */
// PUT 
// Update template by ID
export const updateTemplate = errorWrapper(async (req, res) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, message: 'Invalid template ID', data: id };
    const template = await Template.findByIdAndUpdate(id, { ...req.body, createdBy: req.user._id }, { new: true, runValidators: true }).populate('createdBy', 'name email').populate('config.business', 'name').populate('config.collections', 'name').populate('config.channels', 'name').populate('config.actions', 'name');
    if (!template) return { statusCode: 400, message: 'Template not found', data: id };
    return { statusCode: 200, message: 'Template updated successfully', data: template }
});

// Partial update template by ID
// Patch
export const partialUpdateTemplate = errorWrapper(async (req, res) => {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return { statusCode: 400, message: 'Invalid template ID', data: id };
    const template = await Template.findByIdAndUpdate(id, { $set: req.body }, { new: true, runValidators: true }).populate('createdBy', 'name email').populate('config.business', 'name').populate('config.collections', 'name').populate('config.channels', 'name').populate('config.actions', 'name');
    if (!template) return { statusCode: 400, message: 'Template not found', data: id };
    return { statusCode: 200, message: 'Template updated successfully', data: template }
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