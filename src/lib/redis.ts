import { Redis } from 'ioredis';

const redisOptions = {
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  reconnectOnError: (err: Error) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

// Add event listeners for better error handling and monitoring
redis.on('error', (error: Error) => {
  console.error('Redis Client Error:', error);
});

redis.on('connect', () => {
  console.log('Redis Client Connected');
});

redis.on('ready', () => {
  console.log('Redis Client Ready');
});

redis.on('end', () => {
  console.log('Redis Client Connection Ended');
});

redis.on('reconnecting', () => {
  console.log('Redis Client Reconnecting...');
});

// Helper function to check Redis connection
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis Connection Check Failed:', error);
    return false;
  }
};

export default redis;