import { model, Schema } from 'mongoose';
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
    },
    config: {
        in: { type: String, enum: ['header', 'query'], default: 'header' },
        name: { type: String, default: 'x-api-key' }
    }
}, baseOpts);

const basicSchema = new Schema({
    credentials: {
        username: String,
        password: String,
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
//  Stripe → apiKey
// Google → oauth2
// AWS → hmac
// Twilio → basic
// Slack → oauth2
// Internal APIs → customHeader
export const ApiAuthenticators = model('ApiAuthenticators', ApiAuthenticationSchema, 'ApiAuthenticators');
