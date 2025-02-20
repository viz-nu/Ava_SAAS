import mongoose from "mongoose";
import { createClient } from 'redis';

export const connectDB = async (retryCount = 0) => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');
    } catch (err) {
        if (retryCount < 5) {  // Set a maximum number of retries
            console.error('Error connecting to MongoDB. Retrying...', err);
            setTimeout(() => connectDB(retryCount + 1), 5000); // Retry after 5 seconds
        } else {
            console.error('Failed to connect to MongoDB after multiple attempts:', err);
            process.exit(1);  // Exit the process after max retries
        }
    }
};
export let redisClient;

export const connectRedis = async () => {
    if (redisClient) return redisClient
    try {
        redisClient = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            password: process.env.REDIS_PASSWORD
        });
        redisClient.on('error', (err) => console.log('Redis Client Error', err));
        await redisClient.connect();
        console.log('Connected to Redis');
        return redisClient;
    } catch (err) {
        console.error('Error connecting to Redis:', err);
    }
};

export const getRedisClient = async () => {
    if (!redisClient) await connectRedis();
    return redisClient;
};

export const initialize = async () => {
    try {
        await Promise.all([
            connectDB(),
            connectRedis()
        ])
        console.log('Application initialized successfully');
    } catch (err) {
        console.error('Error during initialization:', err);
        process.exit(1); // Exit the process if initialization fails
    }
};