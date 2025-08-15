import axios from "axios";
import { Conversation } from "../models/Conversations.js";
import 'dotenv/config'
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
export const generateMeetingUrl = (meetingName) => {
    // Clean up and format the meeting name for use in URL
    const cleanName = meetingName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    // Add random string for uniqueness
    const randomString = Math.random().toString(36).substring(2, 8);

    // Create a Jitsi Meet URL (completely free, no API keys needed)
    const roomName = `${cleanName}-${randomString}`;
    const meetingUrl = `https://meet.jit.si/${roomName}`;
    return meetingUrl
    // return {
    //     url: meetingUrl,
    //     provider: "Jitsi Meet",
    //     roomName: roomName
    // };
}
export const getLocation = async (latitude, longitude) => {
    try {
        const { data } = await axios.get(`https://us1.locationiq.com/v1/reverse?key=${process.env.LOCATIONIQ_API_KEY}&lat=${latitude}&lon=${longitude}&format=json`)
        const reqFields = { city: data.address.city || data.address.town || data.address.village, country_name: data.address.country, region: data.address.state, postal: data.address.postcode }
        return { latitude, longitude, ...data, ...reqFields }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        return { latitude, longitude }
    }
}
export const parseLLMResponse = (responseText) => {
    const mainText = responseText.split('$followupquestions$')[0].trim();
    const followups = [];
    const fqRegex = /\$fq\$(.*?)\$\/fq\$/gs;
    let match;
    while ((match = fqRegex.exec(responseText)) !== null) {
        followups.push(match[1].trim());
    }

    return { mainText, followups };
}
export function createToolWrapper(toolDef) {
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const wrapperBody = `
        "use strict";
        ${toolDef.functionString}
    `;
    const errorFn = toolDef.errorFunction ? `
        "use strict";
        ${toolDef.errorFunction}
    `: null
    let toolSchema = {
        name: toolDef.name,
        description: toolDef.description,
        parameters: buildJSONSchema(toolDef.parameters),
        execute: toolDef.async ? new AsyncFunction('input', wrapperBody) : new Function('input', wrapperBody),
        strict: true,
        errorFunction: errorFn,
        needsApproval: toolDef.needsApproval
    }

    return toolSchema;
}
export function extractMainAndFollowUps(llmResponse) {
    const followupRegex = /\$followupquestions\$(.*?)\$\/followupquestions\$/s;
    const match = llmResponse.match(followupRegex);

    let mainText = llmResponse;
    let followUps = [];

    if (match) {
        // Remove the followup section from main text
        mainText = llmResponse.replace(followupRegex, '').trim();

        // Extract individual follow-up questions
        const fqRegex = /\$fq\$(.*?)\$\/fq\$/gs;
        let fqMatch;
        while ((fqMatch = fqRegex.exec(match[1])) !== null) {
            followUps.push(fqMatch[1].trim());
        }
    }

    return { mainText, followUps };
}
export function buildFollowUpButtons(followUps = []) {
    return {
        type: "button",
        body: {
            text: generateHeading()
        },
        action: {
            buttons: followUps.slice(0, 3).map((question, index) => ({
                type: "reply",
                reply: {
                    id: `followup_${index + 1}`,
                    title: truncate(question, 20)
                }
            }))
        }
    };
}
function truncate(text, maxLength) {
    return text.length <= maxLength ? text : text.slice(0, maxLength - 1) + "…";
}
function generateHeading() {
    const variants = [
        "Here are a few questions you can consider asking:",
        "You might want to follow up with:",
        "Try asking one of these next:",
        "Want to go deeper? Consider these:",
        "Some questions you could ask:"
    ];
    return variants[Math.floor(Math.random() * variants.length)];
}
/** Mark every hour slot the conversation overlapped */
export const markHourBuckets = (arr, start, end) => {
    if (!start || !end || end < start) return;

    // Align cursor to the beginning of the start hour
    let cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);

    // Ceil end to the next hour boundary **unless** already on a boundary
    const endCeil = new Date(end);
    if (end.getMinutes()) endCeil.setHours(endCeil.getHours() + 1, 0, 0, 0);

    while (cursor < endCeil) {
        // Each loop is a full 1‑hour slot [hh:00 → hh+1:00)
        arr[cursor.getHours()]++;
        cursor.setHours(cursor.getHours() + 1);
    }
}
export const knowledgeToolBaker = (collections) => {
    if (!collections || collections.length < 1) return null;

    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    const wrapperBody = `
        "use strict";
          if (!input.query || !input.options?.source || !Array.isArray(input.options?.source)) {
        throw new Error('Both "query" (string) and "source" (array) are required parameters');
    }
    if (input.query.trim().length < 3) {
        throw new Error('Query must be at least 3 characters long');
    }
    if (input.options.source.length < 1) {
        throw new Error('Source array must have at least one collection');
    }
    const response = await fetch('https://chatapi.campusroot.com/fetch-from-db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        query: input.query,
        collections: input.options.source
    })
    });
    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || 'Knowledge base fetch failed');
    }
    return \`Answer from the knowledge base for query: "\${input.query}"\\n\\n\${data.data}\`;
    `;
    const errorFn = `
        "use strict";
    console.error('Knowledge fetch failed with input:', input);
    return 'I couldn\\'t retrieve the requested information.Please check your query and source.If the issue persists, try again later.';
    `
    let template = {
        name: "search_knowledge_base",
        description: "Searches the knowledge base using a query and optional source filters.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The text-based search query to retrieve relevant information from the existing vector database."
                },
                options: {
                    type: "object",
                    description: "Additional search parameters such as filtering by source cluster IDs.",
                    properties: {
                        source: {
                            type: "array",
                            description: "Array of knowledge base cluster IDs to narrow the search scope.",
                            items: { type: "string" },
                            default: collections
                        }
                    },
                    required: ["source"],
                    additionalProperties: false
                }
            },
            required: ["query", "options"],
            additionalProperties: false
        },
        execute: new AsyncFunction('input', wrapperBody),
        strict: true,
        errorFunction: errorFn,
        needsApproval: false
    }
    return template;
};
export const buildJSONSchema = (def) => {
    const schema = { type: def.dataType, description: def.description, additionalProperties: false };
    if (def.default !== undefined) schema.default = def.default;
    if (def.enum && Array.isArray(def.enum)) schema.enum = def.enum;
    if (def.pattern) schema.pattern = def.pattern;
    if (def.dataFormat) schema.format = def.dataFormat;
    if (def.dataType === "object") {
        schema.properties = {};
        schema.required = [];
        if (def.properties) {
            for (const [key, value] of Object.entries(def.properties)) {
                schema.properties[key] = buildJSONSchema(value);
                if (value.isRequired) schema.required.push(key);
            }
        }
        schema.additionalProperties = Boolean(def.additionalProperties);
        // ✅ Add anyOf logic for conditional requirement
        if (def.anyOf && Array.isArray(def.anyOf) && def.anyOf.length > 0) schema.anyOf = def.anyOf;
    }
    if (def.dataType === "array") schema.items = (def.properties && def.properties.items) ? buildJSONSchema(def.properties.items) : { type: "any" };
    return schema;
}
