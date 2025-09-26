import { FastifyInstance } from 'fastify';
import { apiLogger } from '@/services/logger';
import conversationsRoutes from '@/routes/conversations';

export async function setupRoutes(app: FastifyInstance): Promise<void> {
  try {
    apiLogger.info('Setting up API routes');

    // API prefix
    await app.register(async function apiRoutes(app) {
      // Register conversation routes
      await app.register(conversationsRoutes);

      // TODO: Register remaining route modules
      // await app.register(strategyRoutes, { prefix: '/strategies' });
      // await app.register(backtestRoutes, { prefix: '/backtest' });
      // await app.register(paperTradingRoutes, { prefix: '/paper' });
      // await app.register(liveRoutes, { prefix: '/live' });
      // await app.register(marketDataRoutes, { prefix: '/market' });

      // Temporary placeholder routes for testing
      app.get('/', {
        schema: {
          description: 'API root endpoint',
          tags: ['Health'],
          response: {
            200: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    version: { type: 'string' },
                    timestamp: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }, async (_request, reply) => {
        await reply.send({
          success: true,
          data: {
            message: 'DQuant Trading Backend API - TypeScript Edition',
            version: '2.0.0',
            timestamp: new Date().toISOString()
          }
        });
      });

      // API status endpoint
      app.get('/status', {
        schema: {
          description: 'API status and statistics',
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
                    uptime: { type: 'number' },
                    memory: { type: 'object' },
                    timestamp: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }, async (_request, reply) => {
        const memoryUsage = process.memoryUsage();

        await reply.send({
          success: true,
          data: {
            status: 'operational',
            uptime: process.uptime(),
            memory: {
              rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100,
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
              external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
              unit: 'MB'
            },
            timestamp: new Date().toISOString()
          }
        });
      });

    }, { prefix: '/api' });

    apiLogger.info('API routes setup completed');

  } catch (error) {
    apiLogger.error('Failed to setup API routes', error as Error);
    throw error;
  }
}