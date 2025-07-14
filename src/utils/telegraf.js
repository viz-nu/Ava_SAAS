import { AgentModel } from "../models/Agent.js";
import { Channel } from "../models/Channels.js";

export const getBotDetails = async ({ type, botId }) => {
    try {
        let channelDetails
        switch (type) {
            case "telegram":
                channelDetails = await Channel.findOne({ "config.id": botId })
                break;
            case "whatsapp":
                channelDetails = await Channel.findOne({ "config.phone_number_id": botId })
                break;
            default:
                break;
        }
        const agentDetails = await AgentModel.findOne({ channels: channelDetails._id }).populate("business actions")
        console.log({ agentDetails, channelDetails });
        
        return { agentDetails, channelDetails }
    } catch (error) {
        console.log(error);
        return null
    }
}
export const categorizeTelegramTrigger = (update) => {
    if (update.message) {
        const msg = update.message;
        if (msg.text) return (msg.text.startsWith('/')) ? 'command' : 'text_message';
        if (msg.photo) return 'photo';
        if (msg.video) return 'video';
        if (msg.document) return 'document';
        if (msg.voice) return 'voice';
        if (msg.audio) return 'audio';
        if (msg.sticker) return 'sticker';
        if (msg.contact) return 'contact';
        if (msg.location) return 'location';
        if (msg.new_chat_members) return 'new_chat_members';
        if (msg.left_chat_member) return 'left_chat_member';
        return 'other_message';
    }

    if (update.edited_message) return 'edited_message';
    if (update.callback_query) return 'callback_query';
    if (update.inline_query) return 'inline_query';
    if (update.chat_join_request) return 'chat_join_request';
    if (update.my_chat_member) return 'my_chat_member';
    if (update.chat_member) return 'chat_member';

    return 'unknown';
}
export const loggingResults = (result) => {
    // Log all available properties from RunResultBase
    console.log('=== COMPLETE AGENT RUN RESULT ===');
    // history - Complete conversation flow including inputs and generated content
    // console.log('\n1. HISTORY (input + generated items):');
    // console.log(JSON.stringify(result.history, null, 2));
    // // output - New model data that can be used for next runs
    // console.log('\n2. OUTPUT (new model data):');
    // console.log(JSON.stringify(result.output, null, 2));
    // // input - Original input items - PRevMessages
    // console.log('\n3. INPUT (original input):');
    // console.log(JSON.stringify(result.input, null, 2));

    // console.log('\n4. NEW ITEMS (run items with agent associations):');
    // console.log(JSON.stringify(result.newItems, null, 2));

    console.log('\n5. RAW RESPONSES (LLM responses):');
    console.log(JSON.stringify(result.rawResponses, null, 2));

    // console.log('\n6. LAST RESPONSE ID:');
    // console.log(result.lastResponseId);

    // console.log('\n7. LAST AGENT:');
    // console.log(result.lastAgent);

    // console.log('\n8. INPUT GUARDRAIL RESULTS:');
    // console.log(JSON.stringify(result.inputGuardrailResults, null, 2));

    // console.log('\n9. OUTPUT GUARDRAIL RESULTS:');
    // console.log(JSON.stringify(result.outputGuardrailResults, null, 2));

    // console.log('\n10. INTERRUPTIONS:');
    // console.log(JSON.stringify(result.interruptions, null, 2));

    // console.log('\n11. FINAL OUTPUT:');
    // console.log(JSON.stringify(result.finalOutput, null, 2));

    // console.log('\n12. STATE:');
    // console.log(JSON.stringify(result.state, null, 2));

    console.log('\n=== END RESULT LOGGING ===');

    // Also log the entire result object to see if there are any additional properties
    console.log('\n=== FULL RESULT OBJECT ===');
    console.log(JSON.stringify(result, null, 2));
}