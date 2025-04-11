import axios from "axios"
export const sendWAMessage = async ({ token, phone_number_id, messaging_product = "whatsapp", to, type = "text", Data }) => {
    try {
        const whatsappApiUrl = `https://graph.facebook.com/v20.0/${phone_number_id}/messages`;
        // Default payload structure
        let payload = { messaging_product, recipient_type: "individual", to: to };
        // Handle different message types
        if (type === "text") {
            payload.type = "text";
            payload.text = Data;
        } else if (type === "image") {
            payload.type = "image";
            payload.image = Data;
        } else if (type === "audio") {
            payload.type = "audio";
            payload.audio = Data;
        } else if (type === "document") {
            payload.type = "document";
            payload.document = Data;
        }
        const { data } = await axios.post(whatsappApiUrl, payload, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        console.log("✅ Message sent successfully:", data);
        return data
    } catch (error) {
        console.error("❌ Error sending WhatsApp message:");
        if (error.response) {
            // The request was made, server responded with a status code outside 2xx
            console.error('Error Response:');
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            // The request was made but no response received
            console.error('No Response received:', error.request);
        } else {
            // Something happened in setting up the request
            console.error('Axios Error Message:', error.message);
        }
        console.error('Config:', error.config);
        return null
    }
}
export const getMediaUrl = async ({ token, mediaId }) => {
    try {
        const response = await axios.get(`https://graph.facebook.com/v16.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        return response.data.url;
    } catch (error) {
        console.error("Error occurred while fetching MediaUrl:", error);
        return null
    }
}

// Function to download audio file
export const downloadAndTranscribeAudio = async ({ token, url, mediaId, openAiKey }) => {
    const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` }, responseType: 'arraybuffer' });
    const formData = new FormData();
    const audioBlob = new Blob([response.data], { type: 'audio/ogg' });
    // Add the file to the form data
    formData.append('file', audioBlob, `audio-${mediaId}.ogg`);
    formData.append('model', 'whisper-1');
    // Send directly to OpenAI Whisper API
    const transcriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, { headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'multipart/form-data' } });
    return transcriptionResponse.data.text;
}