import { createApp } from './app';
import { config } from '@/config/environment';
import { logger } from '@/services/logger';

async function start(): Promise<void> {
  try {
    // Create the Fastify application
    const app = await createApp();

    // Start the server
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST
    });

    logger.info(`🚀 DQuant Backend TypeScript server started`);
    logger.info(`📡 Server listening at: ${address}`);
    logger.info(`📚 API Documentation: ${address}/documentation`);
    logger.info(`🔍 Health Check: ${address}/health`);
    logger.info(`🌍 Environment: ${config.NODE_ENV}`);
    logger.info(`📊 Database: ${config.DATABASE_URL ? 'Connected' : 'Not configured'}`);
    logger.info(`🗄️ Redis: ${config.REDIS_URL ? 'Connected' : 'Not configured'}`);

    // Development mode specific logging
    if (config.NODE_ENV === 'development') {
      logger.info(`🛠️ Development mode enabled`);
      logger.info(`🔄 Hot reload active with tsx`);
    }

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Rejection:', reason as Error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
start().catch((error) => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});