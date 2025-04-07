import axios from "axios"

export const sendWAMessage = async ({ to, type = "text", Data = {} }) => {
    try {

        const whatsappApiUrl = 'https://graph.facebook.com/v20.0/phone_number_id/messages';
        const token = process.env.AVAKADO_WABA_TOKEN;
        // Default payload structure
        let payload = { messaging_product: "whatsapp", recipient_type: "individual", to: to };
        // Handle different message types
        if (type === "text") {
            payload.type = "text";
            payload.text = { body: Data.text };
        } else if (type === "image") {
            payload.type = "image";
            payload.image = { link: Data.url };
        } else if (type === "audio") {
            payload.type = "audio";
            payload.audio = { link: Data.url };
        } else if (type === "document") {
            payload.type = "document";
            payload.document = { link: Data.url, caption: Data.caption || "" };
        }
        const { data } = await axios.post(whatsappApiUrl, payload, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
        console.log("✅ Message sent successfully:", responseData);
        return data
    } catch (error) {
        console.error("❌ Error sending WhatsApp message:", error);
        return null
    }
}
// sendTemplateMessage()

// sendTextMessage()

// sendMediaMessage()

// uploadImage()