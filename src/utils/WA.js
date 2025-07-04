import axios from "axios"
export const sendWAMessage = async ({ token, phone_number_id, messaging_product = "whatsapp", to, type = "text", Data }) => {
    try {
        const whatsappApiUrl = `https://graph.facebook.com/v22.0/${phone_number_id}/messages`;
        // Default payload structure
        let payload = { messaging_product, recipient_type: "individual", to: to };
        // Handle different message types
        switch (type) {
            case "text":
                payload.type = "text";
                payload.text = Data;
                break;
            case "image":
                payload.type = "image";
                payload.image = Data;
                break;
            case "audio":
                payload.type = "audio";
                payload.audio = Data;
                break;
            case "document":
                payload.type = "document";
                payload.document = Data;
                break;
            case "interactive":
                payload.type = "interactive";
                payload.interactive = Data;
                break;
            default:
                break;
        }
        const { data } = await axios.post(whatsappApiUrl, payload, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        // console.log("✅ Message sent successfully:", data);
        return data
    } catch (error) {
        console.error("❌ Error sending WhatsApp message:");
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        return null
    }
}
export const getMediaTranscriptions = async ({ token, mediaId, openAiKey, transcriptionModel = "whisper-1" }) => {
    try {
        const { data } = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const response = await axios.get(data.url, { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'arraybuffer' });
        const formData = new FormData();
        const audioBlob = new Blob([response.data], { type: 'audio/ogg' });
        // Add the file to the form data
        formData.append('file', audioBlob, `audio-${mediaId}.ogg`);
        formData.append('model', transcriptionModel);
        // Send directly to OpenAI Whisper API
        const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, { headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'multipart/form-data' } });
        return transcriptionResponse.data.text;

    } catch (error) {
        console.error("Error occurred while fetching MediaUrl:");
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        return "some audio that cannot be processed"
    }
}