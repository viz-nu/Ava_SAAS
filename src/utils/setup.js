import OauthCalendly from "../services/ExternalAuthenticationServices/calendly.js";
import OauthExotel from "../services/ExternalAuthenticationServices/exotel.js";
import OauthGoogle from "../services/ExternalAuthenticationServices/google.js";
import OauthInstagram from "../services/ExternalAuthenticationServices/instagram.js";
import OauthMicrosoft from "../services/ExternalAuthenticationServices/microsoft.js";
import OauthTataTele from "../services/ExternalAuthenticationServices/tatatele.js";
import OauthTelegram from "../services/ExternalAuthenticationServices/telegram.js";
import OauthTwilio from "../services/ExternalAuthenticationServices/twilio.js";
import OauthWhatsApp from "../services/ExternalAuthenticationServices/whatsapp.js";

export const PROVIDER_MAP = {
    "Whatsapp": OauthWhatsApp,
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