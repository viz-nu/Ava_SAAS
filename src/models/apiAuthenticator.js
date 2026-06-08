import { model, Schema } from 'mongoose';
import { PROVIDER_MAP, providerSupportsRefresh } from '#resources/services/ProviderMap.js';

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const baseOpts = { _id: false };      // subdocs don’t need their own _id
const docOpts = { timestamps: true, discriminatorKey: 'authType' };
const credentialOpts = { _id: false, strict: false };

const ApiAuthenticationSchema = new Schema({
    provider: { type: Schema.Types.ObjectId, ref: 'Providers' },
    accountDetails: Schema.Types.Mixed,
    scope: [String],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
}, docOpts);

// oauth2: Google, Microsoft, Calendly, Instagram, WhatsApp
const oauth2CredentialsSchema = new Schema({
    tokenId: String,
    accessToken: String,
    refreshToken: String,
    expiresAt: Date,
    refreshTokenExpiresAt: Date,
    tokenType: { type: String, default: 'Bearer' },
    // Instagram / Meta provider-specific
    igUserId: String,
    pageId: String,
    pageAccessToken: String,
}, credentialOpts);

const oauth2Schema = new Schema({
    credentials: oauth2CredentialsSchema,
    config: {
        clientId: String,
        clientSecret: String,
        authUrl: String,
        tokenUrl: String,
        redirectUri: String
    }
}, baseOpts);

// apiKey: Exotel, Tata Tele, Telegram
const apiKeyCredentialsSchema = new Schema({
    apiKey: String,
    apiToken: String,
    accountSid: String,
    subdomain: String,
}, credentialOpts);

const apiKeySchema = new Schema({
    credentials: apiKeyCredentialsSchema,
    config: {
        in: { type: String, enum: ['header', 'query'], default: 'header' },
        name: { type: String, default: 'x-api-key' },
        AccountSid: String,
        subdomain: String,
        region: String
    }
}, baseOpts);

const basicSchema = new Schema({
    credentials: {
        username: String,
        password: String,
        basicToken: String,
        id: String,
    }
}, baseOpts);

const bearerSchema = new Schema({
    credentials: {
        token: String,
    }
}, baseOpts);

const jwtSchema = new Schema({
    credentials: {
        token: String,
        expiresAt: Date
    },
    config: {
        issuer: String,
        audience: String,
        algorithm: String
    }
}, baseOpts);


const hmacSchema = new Schema({
    credentials: {
        apiKey: String,
        apiSecret: String,
    },
    config: {
        algorithm: { type: String, default: 'sha256' },
        header: { type: String, default: 'x-signature' }
    }
}, baseOpts);

const customHeaderSchema = new Schema({
    credentials: {
        headers: {
            type: Map,
            of: String
        }
    }
}, baseOpts);

const mtlsSchema = new Schema({
    credentials: {
        cert: String,
        key: String,
        ca: String
    }
}, baseOpts);


const cookieSchema = new Schema({
    credentials: {
        cookies: {
            type: Map,
            of: String
        }
    }
}, baseOpts);

const noAuthSchema = new Schema({}, baseOpts);

ApiAuthenticationSchema.discriminator('oauth2', oauth2Schema);
ApiAuthenticationSchema.discriminator('apiKey', apiKeySchema);
ApiAuthenticationSchema.discriminator('basic', basicSchema);
ApiAuthenticationSchema.discriminator('bearer', bearerSchema);
ApiAuthenticationSchema.discriminator('jwt', jwtSchema);
ApiAuthenticationSchema.discriminator('hmac', hmacSchema);
ApiAuthenticationSchema.discriminator('customHeader', customHeaderSchema);
ApiAuthenticationSchema.discriminator('mtls', mtlsSchema);
ApiAuthenticationSchema.discriminator('cookie', cookieSchema);
ApiAuthenticationSchema.discriminator('none', noAuthSchema);

ApiAuthenticationSchema.methods.getSecrets = function () {
    return { credentials: this.credentials, config: this.config };
};
ApiAuthenticationSchema.methods.getCredentials = async function () {
    return this.credentials
}
ApiAuthenticationSchema.methods._resolveProvider = async function () {
    await this.populate('provider');
    const serviceProvider = PROVIDER_MAP[this.provider.name];
    if (!serviceProvider) throw new Error(`Unsupported provider: ${this.provider?.name}`);
    return serviceProvider;
}
ApiAuthenticationSchema.methods._plain = function (value) {
    return value?.toObject?.() ?? value ?? {};
}
ApiAuthenticationSchema.methods._enrichedCredentials = function () {
    const creds = { ...this._plain(this.credentials) };
    const config = this._plain(this.config);
    if (this.authType === 'apiKey') {
        creds.accountSid ??= config.AccountSid;
        creds.subdomain ??= config.subdomain;
    }
    return creds;
}
ApiAuthenticationSchema.methods._isAccessTokenFresh = function () {
    const { accessToken, expiresAt } = this._enrichedCredentials();
    if (!accessToken || !expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now() + TOKEN_EXPIRY_BUFFER_MS;
}
ApiAuthenticationSchema.methods.validateToken = async function () {
    const serviceProvider = await this._resolveProvider();
    return serviceProvider.validateToken(this._enrichedCredentials());
}
ApiAuthenticationSchema.methods.refreshToken = async function () {
    const serviceProvider = await this._resolveProvider();
    if (!providerSupportsRefresh(serviceProvider)) {
        throw new Error(`Provider "${this.provider.name}" does not support token refresh`);
    }
    const newTokensRes = await serviceProvider.refreshToken(this._enrichedCredentials());
    if (!newTokensRes.success) throw new Error(newTokensRes.error.message);
    this.credentials = { ...this.credentials, ...newTokensRes.data };
    await this.save();
    return this;
}
ApiAuthenticationSchema.methods.ensureValidToken = async function () {
    const serviceProvider = await this._resolveProvider();

    if (this._isAccessTokenFresh()) return this;

    if (await serviceProvider.validateToken(this.credentials)) return this;

    if (!providerSupportsRefresh(serviceProvider)) {
        throw new Error(`Invalid or expired credentials for ${this.provider.name}; re-authentication required`);
    }

    return this.refreshToken();
}
ApiAuthenticationSchema.methods.hasAllScopes = function (scopes) {
    for (const item of scopes) {
        if (!this.scope.includes(item)) {
            return false;
        }
    }
    return true;
}
//  Stripe → apiKey
// Google → oauth2
// AWS → hmac
// Twilio → basic
// Slack → oauth2
// Internal APIs → customHeader
export const ApiAuthenticators = model('ApiAuthenticators', ApiAuthenticationSchema, 'ApiAuthenticators');
