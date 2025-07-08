import mongoose, { ConnectOptions } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

interface DatabaseConfig {
    uri: string;
    options: ConnectOptions;
}

class DatabaseConnection {
    private static instance: DatabaseConnection;
    private isConnected = false;

    private constructor() {}

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    private getConfig(): DatabaseConfig {
        const mongoURI = process.env.MONGODB_URI;
        if (!mongoURI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }
        return {
            uri: mongoURI,
            options: {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
                autoIndex: process.env.NODE_ENV === 'development',
            }
        };
    }

    public async connect(): Promise<void> {
    if (this.isConnected || mongoose.connection.readyState === 1) {
        console.log('✅ Database already connected');
        return;
    }

    try {
        const config = this.getConfig();

        const conn = await mongoose.connect(config.uri, config.options);

        // ✅ These values will now be defined
        this.isConnected = true;
        console.log(`🚀 MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database Name: ${conn.connection.name}`);

        // ✅ Set listeners AFTER successful connection
        mongoose.connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
            this.isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
            this.isConnected = false;
        });

        process.once('SIGINT', () => this.gracefulShutdown());
        process.once('SIGTERM', () => this.gracefulShutdown());
    } catch (error) {
        console.error('❌ Database connection error:', error instanceof Error ? error.message : error);
        throw error; // 🔁 Don't exit process in serverless envs
    }
}


    public async disconnect(): Promise<void> {
        if (!this.isConnected && mongoose.connection.readyState !== 1) {
            return;
        }
        try {
            await mongoose.disconnect();
            console.log('📴 MongoDB connection closed');
            this.isConnected = false;
        } catch (error) {
            console.error('Error during database disconnection:', error);
        }
    }

    private async gracefulShutdown(): Promise<void> {
        console.log('\n⏳ Received shutdown signal, closing MongoDB connection...');
        await this.disconnect();
        process.exit(0);
    }

    public getConnectionStatus(): boolean {
        return this.isConnected || mongoose.connection.readyState === 1;
    }

    public async ping(): Promise<boolean> {
        try {
            if (!mongoose.connection.db) return false;
            await mongoose.connection.db.admin().ping();
            return true;
        } catch (error) {
            console.error('Database ping failed:', error);
            return false;
        }
    }
}

const dbConnection = DatabaseConnection.getInstance();

export default async (): Promise<void> => {
    await dbConnection.connect();
};

export { dbConnection as DatabaseConnection };
