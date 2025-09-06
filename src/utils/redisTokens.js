import { getRedisClient } from "./dbConnect.js";



export const storeNewToken = async (name, newAccessToken) => {
    try {
        const redisClient = await getRedisClient();
        await redisClient.set(`${name}`, newAccessToken, { 'EX': 3600 }); // 1 hour
    } catch (error) {
        console.error('Error storing token:', error);
        throw error;
    }
}
export const fetchToken = async (name) => {
    try {
        const redisClient = await getRedisClient();
        return await redisClient.get(name) || null
    } catch (error) {
        console.error('Error fetching token:', error);
        throw error;
    }
}