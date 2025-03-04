import axios from "axios";
import NodeCache from "node-cache";

const ipCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

export const getClientIP = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const cloudflareIP = req.headers['cf-connecting-ip']; // Cloudflare users
    const realIP = forwarded ? forwarded.split(',')[0].trim() : null;

    return cloudflareIP || realIP || req.socket.remoteAddress;
};

export const getGeoLocation = async (ip) => {
    if (!ip || ip.startsWith('127.') || ip === '::1') return { error: 'Local request, geolocation skipped.' };
    if (ipCache.has(ip)) return ipCache.get(ip);
    try {
        const { data } = await axios.get(`https://ipinfo.io/${ip}/json`);
        ipCache.set(ip, data);
        return data;
    } catch (err) {
        console.warn(`ipinfo.io failed for ${ip}, trying fallback...`);
    }
    try {
        const { data } = await axios.get(`http://ip-api.com/json/${ip}`);
        ipCache.set(ip, data);
        return data;
    } catch (err) {
        console.error(`Both geolocation services failed for ${ip}`);
        return { error: 'Geolocation lookup failed' };
    }
};