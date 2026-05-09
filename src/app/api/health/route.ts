// GET /api/health - Health check and MongoDB connection test
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      mongoUriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 25) + '...' : 'NOT SET',
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeEnv: process.env.NODE_ENV,
    }
  };

  // Test MongoDB connection
  try {
    const { connectDB } = await import('@/lib/mongodb');
    await connectDB();
    health.mongodb = 'connected';
  } catch (error: any) {
    health.mongodb = `error: ${error.message}`;
  }

  return Response.json(health);
}
