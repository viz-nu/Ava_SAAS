import { model, Schema } from 'mongoose';
import { PROVIDER_MAP } from '../utils/setup.js';
const baseOpts = { _id: false };      // subdocs don’t need their own _id
const docOpts = { timestamps: true, discriminatorKey: 'authType' };
const ApiAuthenticationSchema = new Schema({
    provider: { type: Schema.Types.ObjectId, ref: 'Providers' },
    accountDetails: Schema.Types.Mixed,
    scope: [String],
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' },
    business: { type: Schema.Types.ObjectId, ref: 'Businesses' },
}, docOpts);
const oauth2Schema = new Schema({
    credentials: {
        tokenId: String,
        accessToken: String,
        refreshToken: String,
        expiresAt: Date,
        refreshTokenExpiresAt: Date,
        tokenType: { type: String, default: 'Bearer' }
    },
    config: {
        clientId: String,
        clientSecret: String,
        authUrl: String,
        tokenUrl: String,
        redirectUri: String
    }
}, baseOpts);

const apiKeySchema = new Schema({
    credentials: {
        apiKey: String,
        apiToken: String
    },
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
    await this.populate('provider');
    const serviceProvider = PROVIDER_MAP[this.provider.name];
    if (!serviceProvider) throw new Error('Unsupported provider');
    return await serviceProvider.credentials(this.credentials);
}
ApiAuthenticationSchema.methods.refreshToken = async function () {
    await this.populate('provider');
    const serviceProvider = PROVIDER_MAP[this.provider.name];
    if (!serviceProvider) throw new Error('Unsupported provider');
    const newTokensRes = await serviceProvider.refreshToken(this.credentials);
    if (!newTokensRes.success) throw new Error(newTokensRes.error.message);
    const credentials = {
        tokenId: newTokensRes.data.id_token, // keep consistent naming
        accessToken: newTokensRes.data.access_token,
        refreshToken: newTokensRes.data.refresh_token || this.credentials.refreshToken,
        expiresAt: new Date(Date.now() + (newTokensRes.data.expires_in * 1000)),
        tokenType: newTokensRes.data.token_type,
        refreshTokenExpiresAt: newTokensRes.data.refresh_token_expires_in ? new Date(Date.now() + (newTokensRes.data.refresh_token_expires_in * 1000)) : this.credentials.refreshTokenExpiresAt // fallback
    };
    this.credentials = credentials;
    await this.save();
    return this;
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
