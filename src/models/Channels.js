// models/channel.js
import { Schema, model } from 'mongoose';
const { TWILIO_AUTH_TOKEN, DOMAIN, ConnectedAppSidTwilio } = process.env;
const baseOpts = { _id: false };      // subdocs don’t need their own _id
const docOpts = { timestamps: true, discriminatorKey: 'type' };

/* ───────────────────────────── Base Channel ───────────────────────────── */
const ChannelBaseSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        business: { type: Schema.Types.ObjectId, ref: 'Businesses', required: true },
        type: { type: String, enum: ['email', 'whatsapp', 'telegram', 'web', 'phone', 'sms', 'instagram'], required: true },
        status: { type: String, default: 'disabled' },   // enabled | disabled | error
        webhookUrl: String,
        systemPrompt: String,
        isPublic: { type: Boolean, default: false },
        UIElements: Schema.Types.Mixed,
    },
    docOpts
);
ChannelBaseSchema.methods.updateStatus = function (status) {
    this.status = status;
    return this.save();
};
export const Channel = model('Channel', ChannelBaseSchema, 'Channel');

/* ───────────────────────────── Email Channel ──────────────────────────── */
const EmailConfig = new Schema(
    {
        service: { type: String, trim: true },
        host: { type: String, trim: true },
        port: { type: Number, min: 1, max: 65535 },
        secure: { type: Boolean, default: false },             // true ⇢ 465
        fromName: { type: String, trim: true },
        defaultRecipients: {
            to: [{ type: String, lowercase: true, trim: true }],
            cc: [{ type: String, lowercase: true, trim: true }],
            bcc: [{ type: String, lowercase: true, trim: true }],
        },
        verified: { type: Boolean, default: false },
        lastVerifiedAt: Date,
    },
    baseOpts
);

const EmailSecrets = new Schema(
    {
        authType: { type: String, enum: ['login', 'oauth2'], default: 'login' },
        /* login */
        user: { type: String, trim: true },
        pass: { type: String, trim: true },
        /* OAuth‑2 */
        clientId: { type: String, trim: true },
        clientSecret: { type: String, trim: true },
        refreshToken: { type: String, trim: true },
        accessToken: { type: String, trim: true },
        expires: Date,
    },
    baseOpts
);

Channel.discriminator('email', new Schema({ config: EmailConfig, secrets: EmailSecrets }, docOpts));

/* ─────────────────────────── WhatsApp Channel ─────────────────────────── */
const WabaConfig = new Schema(
    {
        phone_number_id: String,
        waba_id: String,
        business_id: String,
        updatedAt: Date,
    },
    baseOpts
);
const WabaSecrets = new Schema({ verificationToken: String, permanentAccessToken: String, phoneNumberPin: Number }, baseOpts);
Channel.discriminator('whatsapp', new Schema({ config: WabaConfig, secrets: WabaSecrets }, docOpts));

/* ─────────────────────────── Telegram Channel ─────────────────────────── */
const TgConfig = new Schema(
    {
        id: String,
        userName: String,
        is_bot: Boolean,
        first_name: String,
        can_join_groups: Boolean,
        can_read_all_group_messages: Boolean,
        supports_inline_queries: Boolean,
        url: String
    },
    baseOpts
);
const TgSecrets = new Schema({ botToken: String }, baseOpts);
Channel.discriminator('telegram', new Schema({ config: TgConfig, secrets: TgSecrets }, docOpts));
/* ───────────────────────────── Web Chat Channel ───────────────────────── */
const WebConfig = new Schema(
    {
        domain: String,
        path: { type: String, default: '/' },
        maxSessions: { type: Number, default: 3 },
        allowedOrigins: [String],
    },
    baseOpts
);

const WebSecrets = new Schema(
    {
        jwtPublicKey: String,
        jwtPrivateKey: String,
    },
    baseOpts
);

Channel.discriminator('web', new Schema({ config: WebConfig, secrets: WebSecrets }, docOpts));

/* ───────────────────────────── Phone Call Channel ─────────────────────── */
const PhoneConfig = new Schema(
    {
        provider: { type: String, enum: ['twilio', 'plivo', 'exotel'] },
        integration: { type: Schema.Types.ObjectId, ref: 'Integration' },
        phoneNumber: String,
        voiceUpdatesWebhookUrl: { type: String, default: function () { return `https://chat.avakado.ai/webhook/${this.provider}/call/status?conversationId=`; } },
        webSocketsUrl: { type: String, default: `wss://sockets.avakado.ai/media-stream` },
        fallbackUrl: String,
    },
    baseOpts
);

const PhoneSecrets = new Schema(
    {
        accountSid: String,
        authToken: String,
        apiKey: String,
        apiSecret: String,
    },
    baseOpts
);

Channel.discriminator(
    'phone',
    new Schema({ config: PhoneConfig, secrets: PhoneSecrets }, docOpts)
);

/* ───────────────────────────── SMS Channel ────────────────────────────── */
const SmsConfig = new Schema(
    {
        provider: { type: String, enum: ['twilio', 'plivo'] },
        phoneNumber: String,
        region: String,
    },
    baseOpts
);

const SmsSecrets = new Schema(
    { accountSid: String, authToken: String },
    baseOpts
);

Channel.discriminator(
    'sms',
    new Schema({ config: SmsConfig, secrets: SmsSecrets }, docOpts)
);

/* ─────────────────────────── Instagram Channel ────────────────────────── */
const IgConfig = new Schema(
    {
        user_id_graphAPI: String,
        igBusinessId: String,
        username: String,
        name: String,
        account_type: String,
        profile_picture_url: String
    },
    baseOpts
);

const IgSecrets = new Schema(
    {
        permissions: [String],
        accessToken: String,
        refreshAt: Date,
    },
    baseOpts
);

Channel.discriminator(
    'instagram',
    new Schema({ config: IgConfig, secrets: IgSecrets }, docOpts)
);