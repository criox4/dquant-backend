import Fastify, { FastifyInstance } from 'fastify';
import { config } from '@/config/environment';
import { setupSwagger } from '@/config/swagger';
import { setupMiddleware } from '@/middleware';
import { setupRoutes } from '@/routes';
import { setupWebSocket } from '@/websocket/server';
import { setupDatabase } from '@/config/database';
import { setupRedis } from '@/config/redis';
import { logger } from '@/services/logger';
import { errorHandler } from '@/middleware/errorHandler';

export async function createApp(): Promise<FastifyInstance> {
  // Create Fastify instance with configuration
  const app = Fastify({
    logger: config.NODE_ENV === 'development' ? {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    } : {
      level: config.LOG_LEVEL
    },
    trustProxy: config.NODE_ENV === 'production',
    keepAliveTimeout: 65000,
    connectionTimeout: 60000,
    bodyLimit: 1048576 * 10, // 10MB
    maxParamLength: 500
  });

  try {
    // Setup error handling first
    app.setErrorHandler(errorHandler);

    // Setup database connection
    const prisma = await setupDatabase();
    app.decorate('prisma', prisma);

    // Setup Redis connection
    const redis = await setupRedis();
    app.decorate('redis', redis);

    // Setup Swagger documentation
    await setupSwagger(app);

    // Setup middleware
    await setupMiddleware(app);

    // Setup WebSocket support
    await setupWebSocket(app);

    // Setup API routes
    await setupRoutes(app);

    // Health check endpoint
    app.get('/health', {
      schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  timestamp: { type: 'string' },
                  uptime: { type: 'number' },
                  services: {
                    type: 'object',
                    properties: {
                      database: { type: 'boolean' },
                      redis: { type: 'boolean' },
                      binance: { type: 'boolean' },
                      openrouter: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }, async (_request, reply) => {
      try {
        // Check database connection
        const dbCheck = await app.prisma.$queryRaw`SELECT 1`;
        const dbStatus = !!dbCheck;

        // Check Redis connection
        const redisStatus = app.redis.isReady;

        // TODO: Add Binance and OpenRouter health checks
        const services = {
          database: dbStatus,
          redis: redisStatus,
          binance: true, // Will be implemented later
          openrouter: true // Will be implemented later
        };

        const healthData = {
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          services
        };

        await reply.status(200).send({
          success: true,
          data: healthData
        });
      } catch (error) {
        logger.error('Health check failed:', error as Error);
        await reply.status(503).send({
          success: false,
          error: 'Service unavailable',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Graceful shutdown handling
    const signals = ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully`);

        try {
          // Close database connection
          await app.prisma.$disconnect();

          // Close Redis connection
          await app.redis.quit();

          // Close Fastify
          await app.close();

          logger.info('Application shut down complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error as Error);
          process.exit(1);
        }
      });
    }

    logger.info('Fastify application configured successfully');
    return app;

  } catch (error) {
    logger.error('Failed to create application:', error as Error);
    throw error;
  }
}

export type App = FastifyInstance;