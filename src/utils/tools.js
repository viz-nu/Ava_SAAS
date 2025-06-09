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
        console.log(error);
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
export const BuiltInTools = [
    {
        async: true,
        name: 'book_deal_slot',
        description: 'Book a slot with a sales or partnership team to make a deal',
        needsApproval: true, // High-value sales meetings need approval
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {
                    "type": "string",
                    "description": "The name of the company the user wants to book a slot with",
                    "minLength": 3
                },
                "preferred_time": {
                    "type": "string",
                    "format": "date-time",
                    "description": "Preferred time of the meeting in iso format (e.g., '2020-01-01T00:00:00.123456Z' for 12am 2020/01/01)"
                },
                "contact_email": {
                    "type": "string",
                    "format": "email",
                    "description": "The user's email address for meeting confirmation"
                }
            },
            "required": [
                "company_name",
                "preferred_time",
                "contact_email"
            ],
            "additionalProperties": false
        },
        functionString: `
            console.log(input.company_name, input.preferred_time, input.contact_email)
            if(!input.company_name || !input.preferred_time || !input.contact_email) {
                throw new Error('Missing required fields: company name, preferred time and contact email are all required')
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRegex.test(input.contact_email)) {
                throw new Error('Invalid email format provided')
            }
            // Validate date format
            const date = new Date(input.preferred_time);
            if(isNaN(date.getTime())) {
                throw new Error('Invalid date format. Please use ISO format like 2024-01-01T14:00:00Z')
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            return \`A slot has been booked with the \${input.company_name} team at \${input.preferred_time}. Confirmation sent to \${input.contact_email}.\`;
        `,
        errorFunction: `
            console.error('Deal booking failed:', input);
            return 'I apologize, but I encountered an error while booking your meeting slot. Please check your details and try again, or contact our support team for assistance.';
        `
    },
    {
        async: true,
        "name": "schedule_expert_meeting",
        "description": "Schedule an appointment with an expert based on availability",
        needsApproval: false, // Regular expert meetings don't need approval
        "parameters": {
            "type": "object",
            "properties": {
                "expert_type": {
                    "type": "string",
                    "description": "The type of expert the user wants to meet (e.g., financial advisor, product specialist)"
                },
                "preferred_date": {
                    "type": "string",
                    "description": "The user's preferred date or time for the appointment (e.g., 'next Monday at 3pm')"
                },
                "user_email": {
                    "type": "string",
                    "description": "The email address to send confirmation details to"
                }
            },
            "required": [
                "expert_type",
                "preferred_date",
                "user_email"
            ],
            "additionalProperties": false
        },
        functionString: `
            if(!input.expert_type || !input.preferred_date || !input.user_email) {
                throw new Error('All fields are required: expert_type, preferred_date, and user_email')
            }
            // Validate email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if(!emailRegex.test(input.user_email)) {
                throw new Error('Please provide a valid email address')
            }
            // Check if expert type is supported
            const supportedExperts = ['financial advisor', 'product specialist', 'technical consultant', 'business analyst'];
            if(!supportedExperts.some(expert => input.expert_type.toLowerCase().includes(expert))) {
                throw new Error(\`Expert type "\${input.expert_type}" is not available. Available experts: \${supportedExperts.join(', ')}\`)
            }
            await new Promise(resolve => setTimeout(resolve, 1200));
            return \`An appointment with a \${input.expert_type} has been scheduled for \${input.preferred_date}. A confirmation has been sent to \${input.user_email}.\`;
        `,
        errorFunction: `
            console.error('Expert meeting scheduling failed:', input);
            return 'Sorry, I couldn\'t schedule your expert meeting. Please verify your details or try again later.';
        `
    },
    {
        async: true,
        "name": "search_knowledge_base",
        "description": "Query a knowledge base to retrieve relevant info on a topic.",
        needsApproval: false, // Knowledge fetching doesn't need approval
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The specific question or topic the user wants information about"
                },
                "source": {
                    "type": "string",
                    "description": "The name of the knowledge base or source to fetch the answer from"
                }
            },
            "required": [
                "query",
                "source"
            ],
            "additionalProperties": false
        },
        functionString: `
            if(!input.query || !input.source) {
                throw new Error('Both query and source are required parameters')
            }
            if(input.query.length < 3) {
                throw new Error('Query must be at least 3 characters long')
            }
            // Simulate source validation
            const availableSources = ['company_docs', 'product_manual', 'faq', 'policy_guide'];
            if(!availableSources.includes(input.source.toLowerCase())) {
                throw new Error(\`Source "\${input.source}" not found. Available sources: \${availableSources.join(', ')}\`)
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
            return \`Based on the source "\${input.source}", here is the answer to your question "\${input.query}": [Detailed Answer from Knowledge Base]\`;
        `,
        errorFunction: `
            console.error('Knowledge fetch failed:', input);
            return 'I couldn\'t retrieve the information you requested. Please check your query and source, or try a different search term.';
        `
    }
];
