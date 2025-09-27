import { FastifyInstance } from 'fastify';
import { apiLogger } from '@/services/logger';
import conversationsRoutes from '@/routes/conversations';
import strategiesRoutes from '@/routes/strategies';
import marketDataRoutes from '@/routes/market-data';
import backtestRoutes from '@/routes/backtest';
import paperTradingRoutes from '@/routes/paper-trading';
import { paperTradingWebSocketRoutes } from '@/routes/paper-trading-websocket';
import performanceAnalyticsRoutes from '@/routes/performance-analytics';

export async function setupRoutes(app: FastifyInstance): Promise<void> {
  try {
    apiLogger.info('Setting up API routes');

    // API prefix
    await app.register(async function apiRoutes(app) {
      // Register conversation routes
      await app.register(conversationsRoutes);

      // Register strategy routes
      await app.register(strategiesRoutes);

      // Register market data routes
      await app.register(marketDataRoutes, { prefix: '/market' });

      // Register backtest routes
      await app.register(backtestRoutes, { prefix: '/backtest' });

      // Register paper trading routes
      await app.register(paperTradingRoutes, { prefix: '/paper' });

      // Register paper trading WebSocket routes
      await app.register(paperTradingWebSocketRoutes, { prefix: '/paper/ws' });

      // Register performance analytics routes
      await app.register(performanceAnalyticsRoutes, { prefix: '/analytics' });

      // TODO: Register remaining route modules
      // await app.register(liveRoutes, { prefix: '/live' });

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