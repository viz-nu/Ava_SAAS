import axios from "axios"
export const sendWAMessage = async ({ phone_number_id = "613445751852844", messaging_product = "whatsapp", to, type = "text", Data }) => {
    try {

        const whatsappApiUrl = `https://graph.facebook.com/v20.0/${phone_number_id}/messages`;
        const token = process.env.AVAKADO_WABA_TOKEN;
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