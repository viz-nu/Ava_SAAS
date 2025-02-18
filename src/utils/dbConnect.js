import mongoose from "mongoose";

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

export const initialize = async () => {
    try {
        await connectDB()
        // console.log('Application initialized successfully');
    } catch (err) {
        console.error('Error during initialization:', err);
        process.exit(1); // Exit the process if initialization fails
    }
};