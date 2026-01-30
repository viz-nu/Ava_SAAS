import { model, Schema } from 'mongoose';
import { Conversation } from './Conversations.js';

const PortSchema = new Schema(
    {
        id: String,
        meta: {
            index: Number,
        },
        label: String,
        schema: Schema.Types.Mixed
    },
    { _id: false }
);
const NodeCoreSchema = new Schema(
    {
        config: Schema.Types.Mixed,
        handlerFunction: { type: String, required: true },
        errorFunction: { type: String }
    },
    { _id: false }
);

const NodeSchema = new Schema(
    {
        type: { type: String, required: true, enum: ['trigger', 'task', 'conditional'] },
        ports: {
            input: {
                type: Map,
                of: PortSchema
            },
            output: {
                type: Map,
                of: PortSchema
            }
        },
        core: NodeCoreSchema,
        meta: {
            label: String,
            type: String
        }
    },
    { _id: false }
);
const ConnectionSchema = new Schema(
    {
        from: { type: String, required: true }, // "nodeId/output/portId"
        to: { type: String, required: true }    // "nodeId/input/portId"
    },
    { _id: false }
);
const WorkflowSchema = new Schema({
    name: { type: String, default: "Untitled Workflow" },
    status: { type: String, enum: ["draft", "active", "disabled"], default: 'draft' },
    nodes: { type: Map, of: NodeSchema, required: true },
    connections: { type: Map, of: ConnectionSchema, required: true },
    business: { type: Schema.Types.ObjectId, ref: "Business" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
}, {
    timestamps: true,
});
WorkflowSchema.index({ createdBy: 1 });
WorkflowSchema.index({ status: 1 });
WorkflowSchema.methods.updateStatus = function (status) {
    this.status = status;
    return this.save();
};
WorkflowSchema.methods.getNextNode = function ({ currentNode = "", outputPortsOfCurentNode = [] }) {
    let nextNodes = []
    if (!currentNode) return [Object.keys(this.nodes).find(ele => this.nodes[ele].type === "trigger")];
    const { type } = this.nodes[currentNode];
    Object.values(this.connections).forEach(ele => {
        if (!ele?.from || !ele?.to) {
            console.log("errored no from or to");
            return;
        }
        const [fromNodeId, , portId] = ele.from.split("/");
        if (fromNodeId !== currentNode) {
            return;
        }
        const [toNodeId] = ele.to.split("/");
        if (type === "conditionalNode") {
            if (outputPortsOfCurentNode.includes(portId)) nextNodes.push(toNodeId);
            return;
        }
        nextNodes.push(toNodeId);
    })
    return nextNodes
};
WorkflowSchema.methods.executeNode = async function ({ input = [], nodeId }) {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    const { handlerFunction, errorFunction, config } = node.core
    const handlerBody = `"use strict"; ${handlerFunction}`, errorBody = `"use strict"; ${errorFunction}`;
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    try {
        const handler = new AsyncFunction("input", "config", handlerBody);
        return await handler(input, config);
    }
    catch (error) {
        const errorHandler = new AsyncFunction("input", "config", "error", errorBody);
        return await errorHandler(input, config, error);
    }
}
WorkflowSchema.methods.execute = async function ({ conversationId, currentNode = "" }) {
    const nodeId = (!currentNode) ? this.getNextNode()[0] : currentNode
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) throw new Error(`Conversation ${conversationId} not found`);
    const output = this.executeNode({ input: conversation.input, nodeId })
    conversation.input.push(output)
    await conversation.save();
    const nextnodes = this.getNextNode({ currentNode: nodeId, outputPortsOfCurentNode: output })
    for await (const element of nextnodes) {
        await this.execute({ conversationId, currentNode: element })
    }
}
export const Workflow = model('Workflow', WorkflowSchema, "Workflow");