import mongoose from 'mongoose';

// ============================================================================
// MongoDB Connection — Build-Safe Configuration
// ============================================================================
// The URI must start with mongodb:// or mongodb+srv://.
// During `next build`, environment variables may not be available, so we
// provide a localhost fallback that allows the build to succeed while still
// warning developers. At runtime the MONGODB_URI must be set correctly.
// ============================================================================

const DEFAULT_URI = 'mongodb://localhost:27017/aafiatak';

function getMongoURI(): string {
  const uri = process.env.MONGODB_URI;
  if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
    return uri;
  }
  if (uri) {
    // Env var exists but has wrong scheme (e.g. Prisma's file: URL)
    console.warn(
      `[mongodb] MONGODB_URI has invalid scheme ("${uri.substring(0, 30)}..."). ` +
      'Expected mongodb:// or mongodb+srv://. Using localhost fallback.'
    );
  }
  return DEFAULT_URI;
}

const MONGODB_URI = getMongoURI();

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,  // Fail fast if DB is unreachable
      connectTimeoutMS: 10000,         // Connection attempt timeout
      socketTimeoutMS: 45000,          // Socket inactivity timeout
      maxPoolSize: 10,                 // Reasonable pool size for serverless
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}

export default connectDB;
export { connectDB };
