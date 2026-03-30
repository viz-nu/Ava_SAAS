import {
    randomBytes,
    createCipheriv,
    createDecipheriv,
    scryptSync
} from 'node:crypto';
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY = scryptSync(process.env.ACCESS_SECRET, 'salt', 32);


export function encrypt(text) {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text) {
    const [ivHex, encrypted] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALGO, KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}