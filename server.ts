import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './api/config/database';
import authRoutes from './api/routes/auth';
import { IApiResponse } from './api/types';

dotenv.config();

const app: Application = express();

const allowedOrigins = [
  'https://crash-canvas.vercel.app',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
}));
console.log('🌐 allowedOrigin:', allowedOrigins);


// CORS middleware 
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

//  Explicitly handle preflight requests
app.options('*', cors());

connectDB().catch((error) => {
  console.error('❌ Failed to connect to database:', error);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

//  API Routes
console.log('Mounting authRoutes at /api/auth');
app.use('/api/auth', authRoutes);

//  Health Check Route
console.log('Mounting health route');
app.get('/api/health', (_: Request, res: Response) => {
  const response: IApiResponse = {
    success: true,
    message: 'Server is running',
    data: {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  };
  res.status(200).json(response);
});

//  Error Handler
app.use((err: Error, _req: Request, res: Response, _: NextFunction): void => {
  console.error('Unhandled error:', err);
  const response: IApiResponse = {
    success: false,
    message: 'Internal server error'
  };

  if (process.env.NODE_ENV === 'development') {
    response.errors = [err.message];
  }

  res.status(500).json(response);
});

app.get('/', (_req, res) => {
  res.send('Crash Canvas Backend is running ✅');
});

//  404 Route Handler
app.use((req: Request, res: Response) => {
  const response: IApiResponse = {
    success: false,
    message: `Route ${req.originalUrl} not found`
  };
  res.status(404).json(response);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Server running...');
});
