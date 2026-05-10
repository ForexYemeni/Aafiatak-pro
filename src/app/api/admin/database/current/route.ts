// GET /api/admin/database/current - Get current database info
// Admin-only: returns the current MongoDB connection details (masked URI)

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    // Get current MongoDB URI (masked for security)
    const currentUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aafiatak';
    let maskedUri = currentUri;
    let dbName = 'unknown';

    try {
      // Extract and mask the URI
      if (currentUri.includes('@')) {
        // mongodb+srv://username:password@cluster.../dbname
        const parts = currentUri.split('@');
        const credentials = parts[0].split('://')[1];
        if (credentials.includes(':')) {
          const [username] = credentials.split(':');
          maskedUri = currentUri.replace(credentials, `${username}:****`);
        }
      }

      // Extract database name
      const urlObj = new URL(currentUri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://'));
      dbName = urlObj.pathname.substring(1) || 'unknown';
      if (dbName.includes('?')) dbName = dbName.split('?')[0];
    } catch {
      // URI parsing failed
    }

    // Get connection status
    const isConnected = mongoose.connection.readyState === 1;
    const connectionState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';

    // Count documents in key collections
    let stats: Record<string, number> = {};
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (db) {
        const collections = await db.listCollections().toArray();
        for (const col of collections.slice(0, 15)) {
          try {
            const count = await db.collection(col.name).estimatedDocumentCount();
            stats[col.name] = count;
          } catch {
            stats[col.name] = -1;
          }
        }
      }
    } catch {
      // Stats not available
    }

    return Response.json({
      success: true,
      data: {
        maskedUri,
        databaseName: dbName,
        isConnected,
        connectionState,
        stats,
        vercelProjectId: process.env.VERCEL_PROJECT_ID ? 'configured' : 'missing',
        vercelToken: process.env.VERCEL_TOKEN ? 'configured' : 'missing',
      },
    });
  } catch (error) {
    console.error('[DB CURRENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب معلومات قاعدة البيانات', 500, 'INTERNAL_ERROR');
  }
}
