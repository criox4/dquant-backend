import { createClient, RedisClientType } from 'redis';
import { config } from '@/config/environment';
import { redisLogger } from '@/services/logger';

// Redis client singleton
let redisClient: RedisClientType;

// Redis connection options
const redisOptions = {
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    commandTimeout: 5000,
    reconnectDelay: 1000,
    lazyConnect: true
  },
  retry_delay_ms: 1000,
  max_attempts: 5
};

export async function setupRedis(): Promise<RedisClientType> {
  try {
    redisLogger.info('Initializing Redis connection');

    // Create Redis client
    redisClient = createClient(redisOptions);

    // Setup event handlers
    redisClient.on('connect', () => {
      redisLogger.info('Redis client connecting');
    });

    redisClient.on('ready', () => {
      redisLogger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      redisLogger.warn('Redis connection closed');
    });

    redisClient.on('error', (error) => {
      redisLogger.error('Redis client error', error, {
        operation: 'redis_client_error'
      });
    });

    redisClient.on('reconnecting', () => {
      redisLogger.info('Redis client reconnecting');
    });

    // Connect to Redis
    await redisClient.connect();

    // Test connection
    await testRedisConnection();

    redisLogger.info('Redis connection established successfully');
    return redisClient;

  } catch (error) {
    redisLogger.error('Failed to setup Redis connection', error as Error);
    throw new Error(`Redis setup failed: ${(error as Error).message}`);
  }
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    redisLogger.debug('Testing Redis connection');

    // Simple ping to test connection
    const pong = await redisClient.ping();

    if (pong === 'PONG') {
      redisLogger.debug('Redis connection test successful');
      return true;
    } else {
      redisLogger.warn('Redis ping returned unexpected response', { response: pong });
      return false;
    }

  } catch (error) {
    redisLogger.error('Redis connection test failed', error as Error, {
      operation: 'connection_test'
    });
    return false;
  }
}

export async function closeRedisConnection(): Promise<void> {
  try {
    if (redisClient && redisClient.isReady) {
      redisLogger.info('Closing Redis connection');
      await redisClient.quit();
      redisLogger.info('Redis connection closed successfully');
    }
  } catch (error) {
    redisLogger.error('Error closing Redis connection', error as Error);
    throw error;
  }
}

// Redis health check
export async function getRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: {
    connected: boolean;
    responseTime: number;
    error?: string;
  };
}> {
  const startTime = Date.now();

  try {
    if (!redisClient || !redisClient.isReady) {
      throw new Error('Redis client not ready');
    }

    // Test with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis health check timeout')), 3000);
    });

    const healthCheckPromise = redisClient.ping();
    const result = await Promise.race([healthCheckPromise, timeoutPromise]) as string;

    if (result !== 'PONG') {
      throw new Error(`Unexpected ping response: ${result}`);
    }

    const responseTime = Date.now() - startTime;

    redisLogger.debug('Redis health check completed', {
      responseTime: `${responseTime}ms`,
      status: 'healthy'
    });

    return {
      status: 'healthy',
      details: {
        connected: true,
        responseTime
      }
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    redisLogger.warn('Redis health check failed', {
      responseTime: `${responseTime}ms`,
      error: errorMessage,
      status: 'unhealthy'
    });

    return {
      status: 'unhealthy',
      details: {
        connected: false,
        responseTime,
        error: errorMessage
      }
    };
  }
}

// Cache helper functions with logging
export class CacheService {
  constructor(private redis: RedisClientType) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const value = await this.redis.get(key);
      const duration = Date.now() - startTime;

      redisLogger.debug('Cache get operation', {
        key,
        hit: value !== null,
        duration: `${duration}ms`
      });

      return value ? JSON.parse(value) : null;
    } catch (error) {
      redisLogger.error('Cache get operation failed', error as Error, { key });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    try {
      const startTime = Date.now();
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.redis.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }

      const duration = Date.now() - startTime;

      redisLogger.debug('Cache set operation', {
        key,
        ttl: ttlSeconds,
        duration: `${duration}ms`
      });

      return true;
    } catch (error) {
      redisLogger.error('Cache set operation failed', error as Error, { key });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.redis.del(key);
      const duration = Date.now() - startTime;

      redisLogger.debug('Cache delete operation', {
        key,
        deleted: result > 0,
        duration: `${duration}ms`
      });

      return result > 0;
    } catch (error) {
      redisLogger.error('Cache delete operation failed', error as Error, { key });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      redisLogger.error('Cache exists operation failed', error as Error, { key });
      return false;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttlSeconds);
      return result;
    } catch (error) {
      redisLogger.error('Cache expire operation failed', error as Error, { key });
      return false;
    }
  }

  async flushAll(): Promise<boolean> {
    try {
      await this.redis.flushAll();
      redisLogger.info('Cache flushed all keys');
      return true;
    } catch (error) {
      redisLogger.error('Cache flush all operation failed', error as Error);
      return false;
    }
  }
}

// Create cache service instance
export const cacheService = new CacheService(redisClient);

// Export Redis client and setup function
export { redisClient };
export default setupRedis;