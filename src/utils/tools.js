import axios from "axios";
import { Conversation } from "../models/Conversations.js";
import { z } from 'zod';
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
    return {
        name: toolDef.name,
        description: toolDef.description,
        parameters: toolDef.parameters,
        execute: toolDef.async ? new AsyncFunction('input', wrapperBody) : new Function('input', wrapperBody),
        strict: true,
        errorFunction: errorFn,
        needsApproval: toolDef.needsApproval
    };
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
