import mongoose from 'mongoose';
import { logger } from './logger';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env'
  );
}

// Disable strict mode for schema validation
mongoose.set('strictQuery', false);

// Modify mongoose to handle string-to-number conversion more flexibly
const originalCast = mongoose.Schema.Types.Number.cast();
mongoose.Schema.Types.Number.cast(function(val: any) {
  if (val === null || val === undefined) {
    return val;
  }
  
  if (typeof val === 'string') {
    // Remove quotes if present
    const cleanValue = val.replace(/^["']|["']$/g, '');
    const num = Number(cleanValue);
    if (!isNaN(num)) {
      return num;
    }
  }
  
  // For objects in queries, return as is
  if (typeof val === 'object' && val !== null) {
    return val;
  }
  
  return originalCast(val);
});

interface GlobalMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: GlobalMongoose;
}

// Initialize the global mongoose object if it doesn't exist
if (!global.mongoose) {
  global.mongoose = {
    conn: null,
    promise: null
  };
}

let connectionLoggedOnce = false;

async function connectToDatabase() {
  // Use the cached connection if available and ready
  if (global.mongoose.conn) {
    if (global.mongoose.conn.connection.readyState === 1) {
      // Only log this at debug level, and only once per session
      if (!connectionLoggedOnce) {
        logger.debug('Using cached MongoDB connection');
        connectionLoggedOnce = true;
      }
      return global.mongoose.conn;
    }
    // Reset connection if not ready
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  }

  // Create a new connection if none exists
  if (!global.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      retryReads: true
    };

    try {
      global.mongoose.promise = mongoose.connect(MONGODB_URI as string, opts)
        .then((mongoose) => {
          logger.info('MongoDB connected successfully');
          connectionLoggedOnce = true;
          return mongoose;
        })
        .catch((error) => {
          logger.error('Failed to connect to MongoDB', error);
          global.mongoose.promise = null;
          throw error;
        });
    } catch (error) {
      logger.error('Error creating MongoDB connection', error);
      throw error;
    }
  }

  try {
    global.mongoose.conn = await global.mongoose.promise;
  } catch (error) {
    logger.error('Error awaiting MongoDB connection', error);
    global.mongoose.promise = null;
    throw error;
  }

  return global.mongoose.conn;
}

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', err);
  // Reset connection on error
  global.mongoose.conn = null;
  global.mongoose.promise = null;
  connectionLoggedOnce = false;
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected. Attempting to reconnect...');
  // Reset connection on disconnect
  global.mongoose.conn = null;
  global.mongoose.promise = null;
  connectionLoggedOnce = false;
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully');
  connectionLoggedOnce = true;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});

export default connectToDatabase;