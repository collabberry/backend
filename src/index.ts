import 'reflect-metadata';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';  // Import mongoose
import { container } from './inversify.config.js';
import { App } from './app.js';

// Initialize configuration
dotenv.config();

// MongoDB connection function
const connectToMongoDB = async () => {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/collabberry';
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);  // Exit if MongoDB connection fails
    }
};

let server;
try {
    // First connect to MongoDB
    await connectToMongoDB();

    // Then start the application server
    const application = container.get<App>(App);
    server = application.app.listen(process.env.PORT, async () => {
        console.log(`Server started at http://localhost:${process.env.PORT}.`);
    });
} catch (err) {
    if (server?.listening) {
        server.close();
    }
    console.error(err);
    process.exitCode = 1;
}
