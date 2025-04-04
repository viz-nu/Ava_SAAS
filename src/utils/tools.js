import axios from "axios";
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


// const update = req.body;

// // Process the update based on its type
// if (update.message) {
//     await handleMessage(update.message);
// } else if (update.callback_query) {
//     await handleCallbackQuery(update.callback_query);
// } else if (update.inline_query) {
//     await handleInlineQuery(update.inline_query);
// }


// Handle various types of messages (text, commands, etc.)
// export const handleMessage = async (message) => {
//     const chatId = message.chat.id;

//     // Handle commands (messages starting with '/')


//     // Handle regular text messages
//     if (message.text) {
//         await handleTextMessage(message);
//         return;
//     }

//     // Handle other message types (photos, documents, etc.)
//     if (message.photo) {
//         await sendTextMessage(chatId, "I received your photo!");
//     } else if (message.document) {
//         await sendTextMessage(chatId, "I received your document!");
//     } else if (message.voice) {
//         await sendTextMessage(chatId, "I received your voice message!");
//     } else if (message.sticker) {
//         await sendTextMessage(chatId, "Nice sticker!");
//     } else {
//         await sendTextMessage(chatId, "I received your message but I'm not sure how to process it.");
//     }
// }

// Handle text commands (messages starting with '/')


// Handle regular text messages (not commands)
// async function handleTextMessage(message) {
//     const chatId = message.chat.id;
//     const text = message.text.toLowerCase();

//     // Example of simple text pattern matching
//     if (text.includes('hello') || text.includes('hi')) {
//         await sendTextMessage(chatId, `Hello ${message.from.first_name}!`);
//     } else if (text.includes('bye')) {
//         await sendTextMessage(chatId, "Goodbye! Come back soon.");
//     } else if (text.includes('help')) {
//         await sendTextMessage(chatId, "Try using the /help command for assistance.");
//     } else {
//         // Echo the message (or implement more complex logic here)
//         await sendTextMessage(chatId, `You said: ${message.text}`);
//     }
// }

// // Handle callback queries (button presses)
// async function handleCallbackQuery(callbackQuery) {
//     const chatId = callbackQuery.message.chat.id;
//     const messageId = callbackQuery.message.message_id;
//     const data = callbackQuery.data;

//     // Acknowledge the callback query
//     await answerCallbackQuery(callbackQuery.id);

//     // Process based on callback data
//     if (data.startsWith('settings_')) {
//         const setting = data.split('_')[1];

//         switch (setting) {
//             case 'notifications':
//                 await editMessageText(
//                     chatId,
//                     messageId,
//                     'Notification Settings:',
//                     [
//                         [
//                             { text: 'All Messages', callback_data: 'notify_all' },
//                             { text: 'Mentions Only', callback_data: 'notify_mentions' }
//                         ],
//                         [
//                             { text: 'None', callback_data: 'notify_none' },
//                             { text: '← Back', callback_data: 'back_to_settings' }
//                         ]
//                     ]
//                 );
//                 break;

//             case 'language':
//                 await editMessageText(
//                     chatId,
//                     messageId,
//                     'Select Language:',
//                     [
//                         [
//                             { text: 'English', callback_data: 'lang_en' },
//                             { text: 'Spanish', callback_data: 'lang_es' }
//                         ],
//                         [
//                             { text: 'French', callback_data: 'lang_fr' },
//                             { text: '← Back', callback_data: 'back_to_settings' }
//                         ]
//                     ]
//                 );
//                 break;

//             case 'profile':
//                 await editMessageText(
//                     chatId,
//                     messageId,
//                     'Profile Settings:',
//                     [
//                         [
//                             { text: 'Edit Name', callback_data: 'profile_name' },
//                             { text: 'Edit Bio', callback_data: 'profile_bio' }
//                         ],
//                         [
//                             { text: '← Back', callback_data: 'back_to_settings' }
//                         ]
//                     ]
//                 );
//                 break;
//         }
//     } else if (data === 'back_to_settings') {
//         await editMessageText(
//             chatId,
//             messageId,
//             'What would you like to change?',
//             [
//                 [
//                     { text: 'Notification Settings', callback_data: 'settings_notifications' },
//                     { text: 'Language', callback_data: 'settings_language' }
//                 ],
//                 [
//                     { text: 'Profile', callback_data: 'settings_profile' }
//                 ]
//             ]
//         );
//     } else if (data.startsWith('notify_')) {
//         const option = data.split('_')[1];
//         await sendTextMessage(chatId, `Notification settings updated to: ${option}`);
//     } else if (data.startsWith('lang_')) {
//         const language = data.split('_')[1];
//         await sendTextMessage(chatId, `Language updated to: ${language}`);
//     } else if (data.startsWith('profile_')) {
//         const section = data.split('_')[1];
//         await sendTextMessage(chatId, `To update your ${section}, please send me the new value.`);
//     }
// }

// // Handle inline queries
// async function handleInlineQuery(inlineQuery) {
//     // Implementation for handling inline queries (if needed)
//     // This is when users type @yourbot in any chat
// }

// // Helper function to send text messages
// async function sendTextMessage(chatId, text) {
//     await axios.post(`${TELEGRAM_API}/sendMessage`, {
//         chat_id: chatId,
//         text: text
//     });
// }

// // Helper function to send messages with inline keyboards
// async function sendInlineKeyboard(chatId, text, keyboard) {
//     await axios.post(`${TELEGRAM_API}/sendMessage`, {
//         chat_id: chatId,
//         text: text,
//         reply_markup: {
//             inline_keyboard: keyboard
//         }
//     });
// }

// // Helper function to edit messages (used for inline keyboards)
// async function editMessageText(chatId, messageId, text, keyboard = null) {
//     const payload = {
//         chat_id: chatId,
//         message_id: messageId,
//         text: text
//     };

//     if (keyboard) {
//         payload.reply_markup = {
//             inline_keyboard: keyboard
//         };
//     }

//     await axios.post(`${TELEGRAM_API}/editMessageText`, payload);
// }

// // Helper function to acknowledge callback queries
// async function answerCallbackQuery(callbackQueryId, text = null) {
//     const payload = {
//         callback_query_id: callbackQueryId
//     };

//     if (text) {
//         payload.text = text;
//     }

//     await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, payload);
// }
