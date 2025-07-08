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
        bufferCommands: false, // important
        autoIndex: process.env.NODE_ENV === 'development',
      }
    };
  }

  public async connect(): Promise<void> {
    // Prevent duplicate connections
    if (this.isConnected || mongoose.connection.readyState === 1) {
      console.log('✅ Database already connected');
      return;
    }

    try {
      const config = this.getConfig();
      const conn = await mongoose.connect(config.uri, config.options);

      // Confirm fully connected before proceeding
      this.isConnected = true;
      console.log(`🚀 MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database Name: ${conn.connection.name}`);

      // Setup graceful shutdown only once
      process.once('SIGINT', () => this.gracefulShutdown());
      process.once('SIGTERM', () => this.gracefulShutdown());

      // Log disconnection and errors
      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB error:', err);
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Database connection error:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected && mongoose.connection.readyState !== 1) return;

    try {
      await mongoose.disconnect();
      console.log('📴 MongoDB connection closed');
      this.isConnected = false;
    } catch (error) {
      console.error('Error during database disconnection:', error);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('\n⏳ Gracefully shutting down MongoDB...');
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

// Singleton export
const dbConnection = DatabaseConnection.getInstance();

export default async (): Promise<void> => {
  await dbConnection.connect();
};

export { dbConnection as DatabaseConnection };
