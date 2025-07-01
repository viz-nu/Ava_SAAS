import { errorWrapper } from "../../middleware/errorWrapper.js";
import { Action } from "../../models/Action.js";
import { AgentModel } from "../../models/Agent.js";
import { Business } from "../../models/Business.js";

export const createActions = errorWrapper(async (req, res) => {
    const business = await Business.findById(req.user.business)
    if (!business) return { statusCode: 404, message: "Business not found", data: null }
    const action = await Action.create({ business: business._id, ...req.body })
    return { statusCode: 201, message: "Action created successfully", data: action }
});
export const getActions = errorWrapper(async (req, res) => {
    const filter = { business: req.user.business }
    if (req.params.id) filter._id = req.params.id
    const actions = await Action.find(filter);
    return { statusCode: 200, message: `Action${req.params.id ? "" : "s"} fetched successfully`, data: actions }
});
export const updateAction = errorWrapper(async (req, res) => {
    const action = await Action.findOneAndUpdate({ _id: req.params.id, business: req.user.business }, { ...req.body }, { new: true });
    if (!action) return res.status(404).json({ message: "Action not found" });
    return { statusCode: 200, message: "Action updated successfully", data: action }
});
export const deleteAction = errorWrapper(async (req, res) => {
    const [action, affected] = await Promise.all([
        Action.findOne({ _id: req.params.id, business: req.user.business }),
        AgentModel.find({ actions: id }, "_id")
    ]);
    if (!action) return res.status(404).json({ message: "Action not found" });
    await Promise.all([
        Action.findByIdAndDelete(req.params.id),
        AgentModel.updateMany({ actions: req.params.id, business: req.user.business }, { $pull: { actions: req.params.id } })
    ]);
    const updatedAgents = await AgentModel.find({ _id: { $in: affected.map(a => a._id) } });
    return { statusCode: 200, message: "Action deleted successfully", data: { updatedAgents } }
});