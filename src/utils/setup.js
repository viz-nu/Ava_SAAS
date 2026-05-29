import OauthWhatsapp from "../services/Oauth/whatsapp.js";
import OauthInstagram from "../services/Oauth/instagram.js";
import OauthTelegram from "../services/ApiKey/twilio.js";
import OauthGoogle from "../services/Oauth/google.js";
import OauthMicrosoft from "../services/Oauth/microsoft.js";
import OauthCalendly from "../services/Oauth/calendly.js";
import OauthExotel from "../services/ApiKey/exotel.js";
import OauthTataTele from "../services/ApiKey/tatatele.js";
import OauthTwilio from "../services/ApiKey/twilio.js";
export const PROVIDER_MAP = {
    "Whatsapp": OauthWhatsapp,
    "Instagram": OauthInstagram,
    "Twilio": OauthTwilio,
    'Gmail': OauthGoogle,
    'Google Drive': OauthGoogle,
    'Google Forms': OauthGoogle,
    'Google Calendar': OauthGoogle,
    'Google Sheets': OauthGoogle,
    'Microsoft Excel': OauthMicrosoft,
    'Calendly': OauthCalendly,
    'Telegram': OauthTelegram,
    // 'Avakado.ai': OauthAvakado,
    'Exotel': OauthExotel,
    'Tata Tele': OauthTataTele,
};