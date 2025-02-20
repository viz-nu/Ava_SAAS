import { getRedisClient } from "./dbConnect.js";
const redisClient = await getRedisClient();


export const storeNewToken = async (name, newAccessToken) => {
    try {
        await redisClient.set(`${name}`, newAccessToken, { 'EX': 3600 }); // 1 hour
    } catch (error) {
        console.error('Error storing token:', error);
        throw error;
    }
}
export const fetchToken = async (name) => {
    try {
        return await redisClient.get(name) || null
    } catch (error) {
        console.error('Error storing token:', error);
        throw error;
    }
}