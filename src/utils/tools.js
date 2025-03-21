import { Conversation } from "../models/Conversations.js";

export const populateStructure = (child, dataMap, parentPath = "") => {
    const result = []
    if (child.dataType == "object") child.childSchema.forEach(ele => result.push(...populateStructure(ele, dataMap, parentPath + "/" + child.key)))
    else {
        if (child.userDefined) {
            const obj = { ...child, fieldPath: parentPath + "/" + child.key }
            const value = dataMap.get(child.key);
            if (value !== undefined) obj.data = value || null;
            result.push(obj)
        }
    }
    return result
}
export const sessionFetcher = async (actionId, conversationId, fieldPath) => {
    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return null;
        return conversation.session[actionId]?.[fieldPath]
    } catch (error) {
        console.log(error);
        return null;
    }
}
export const updateSession = async (conversationId, inputData) => {
    try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return null;
        const { actionId, collectedData } = inputData;
        conversation.session ??= {}; // Ensure session object exists
        conversation.session[actionId] ??= {}; // Ensure actionId entry exists
        collectedData.forEach(item => conversation.session[actionId][item.fieldPath] = item);
        await conversation.save();
    } catch (error) {
        console.log("Session save errored");
        console.log(error);
    }
}
export const dataBaker = async (schema, actionId, conversationId, parentPath = "") => {
    let obj = new Object(), temp2;
    switch (schema.dataType) {
        case "string":
            obj[schema.key] = schema.type == "static" ? schema.defaultValue : (await sessionFetcher(actionId, conversationId, parentPath + "/" + schema.key))?.data || null;
            break;
        case "number":
            obj[schema.key] = schema.type == "static" ? schema.defaultValue : (await sessionFetcher(actionId, conversationId, parentPath + "/" + schema.key))?.data || null;
            break;
        case "object":
            temp2 = new Object();
            for (const element of schema.childSchema) {
                let temp = await dataBaker(element, actionId, conversationId, parentPath + "/" + schema.key); // Fix array merging
                temp2 = { ...temp2, ...temp };
            }
            obj[schema.key] = temp2
            break;
        case "array":
            temp2 = [];
            for (const [i, element] of schema.childSchema.entries()) {
                let temp = await dataBaker(element, actionId, conversationId, parentPath + "/" + schema.key); // Fix array merging
                temp2 = [...temp2, temp[i]];
            }
            obj[schema.key] = temp2
            break;
    }
    return obj
}