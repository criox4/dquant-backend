/**
 * Market Data API Routes - Real-time and Historical Data Endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { marketDataService } from '@/services/market-data';
import { apiLogger } from '@/services/logger';

// Zod schemas for request validation
const historicalDataSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
    errorMap: () => ({ message: 'Invalid timeframe' })
  }),
  startTime: z.number().int().positive('Start time must be positive'),
  endTime: z.number().int().positive('End time must be positive'),
  limit: z.number().int().min(1).max(1000).optional().default(100)
});

const tickerSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required')
});

const subscriptionSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  channels: z.array(z.string()).min(1, 'At least one channel required')
});

async function marketDataRoutes(app: FastifyInstance): Promise<void> {
  // Historical candle data endpoint
  app.get('/historical/:symbol/:timeframe', {
    schema: {
      description: 'Get historical candlestick data for a symbol',
      tags: ['Market Data'],
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTC/USDT)' },
          timeframe: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] }
        },
        required: ['symbol', 'timeframe']
      },
      querystring: {
        type: 'object',
        properties: {
          startTime: { type: 'number', description: 'Start timestamp in milliseconds' },
          endTime: { type: 'number', description: 'End timestamp in milliseconds' },
          limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'number' },
                  open: { type: 'number' },
                  high: { type: 'number' },
                  low: { type: 'number' },
                  close: { type: 'number' },
                  volume: { type: 'number' },
                  symbol: { type: 'string' },
                  timeframe: { type: 'string' }
                }
              }
            },
            symbol: { type: 'string' },
            timeframe: { type: 'string' },
            timestamp: { type: 'number' },
            source: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol, timeframe } = request.params as { symbol: string; timeframe: string };
    const query = request.query as any;

    try {
      // Default time range (last 24 hours if not specified)
      const endTime = query.endTime || Date.now();
      const startTime = query.startTime || (endTime - (24 * 60 * 60 * 1000));

      const validation = historicalDataSchema.safeParse({
        symbol,
        timeframe,
        startTime,
        endTime,
        limit: query.limit
      });

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request parameters',
          details: validation.error.issues
        });
      }

      apiLogger.info('Historical data request', {
        symbol,
        timeframe,
        startTime,
        endTime,
        limit: validation.data.limit
      });

      const result = await marketDataService.getHistoricalData({
        symbol,
        timeframe,
        startTime,
        endTime,
        limit: validation.data.limit
      });

      await reply.send(result);

    } catch (error) {
      apiLogger.error('Failed to get historical data', error as Error, {
        symbol,
        timeframe
      });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve historical data'
      });
    }
  });

  // Real-time ticker endpoint
  app.get('/ticker/:symbol', {
    schema: {
      description: 'Get real-time ticker data for a symbol',
      tags: ['Market Data'],
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTC/USDT)' }
        },
        required: ['symbol']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                price: { type: 'number' },
                change24h: { type: 'number' },
                changePercent24h: { type: 'number' },
                high24h: { type: 'number' },
                low24h: { type: 'number' },
                volume24h: { type: 'number' },
                timestamp: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };

    try {
      const validation = tickerSchema.safeParse({ symbol });

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid symbol parameter'
        });
      }

      const ticker = await marketDataService.getTicker(symbol);

      if (!ticker) {
        return reply.status(404).send({
          success: false,
          error: 'Ticker not found',
          message: `No ticker data available for symbol: ${symbol}`
        });
      }

      await reply.send({
        success: true,
        data: ticker
      });

    } catch (error) {
      apiLogger.error('Failed to get ticker', error as Error, { symbol });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve ticker data'
      });
    }
  });

  // Get all available symbols endpoint
  app.get('/symbols', {
    schema: {
      description: 'Get list of available trading symbols',
      tags: ['Market Data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                symbols: {
                  type: 'array',
                  items: { type: 'string' }
                },
                timeframes: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'DOT/USDT'];
      const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

      await reply.send({
        success: true,
        data: {
          symbols,
          timeframes
        }
      });

    } catch (error) {
      apiLogger.error('Failed to get symbols', error as Error);

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Market data statistics endpoint
  app.get('/stats', {
    schema: {
      description: 'Get market data service statistics',
      tags: ['Market Data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalRequests: { type: 'number' },
                successfulRequests: { type: 'number' },
                failedRequests: { type: 'number' },
                averageResponseTime: { type: 'number' },
                cacheHitRate: { type: 'number' },
                activeSubscriptions: { type: 'number' },
                dataPointsReceived: { type: 'number' },
                uptime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = marketDataService.getStats();

      await reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      apiLogger.error('Failed to get market data stats', error as Error);

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // WebSocket subscription management endpoint
  app.post('/subscribe', {
    schema: {
      description: 'Create a new WebSocket subscription for real-time data',
      tags: ['Market Data'],
      body: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' },
          channels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Data channels to subscribe to'
          }
        },
        required: ['symbol', 'channels']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                subscriptionId: { type: 'string' },
                symbol: { type: 'string' },
                channels: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    try {
      const validation = subscriptionSchema.safeParse(body);

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid subscription parameters',
          details: validation.error.issues
        });
      }

      // Create subscription
      const subscriptionId = marketDataService.subscribe({
        symbol: validation.data.symbol,
        channels: validation.data.channels,
        onData: (data) => {
          // Data will be sent via WebSocket
          apiLogger.debug('Real-time data received', {
            subscriptionId,
            symbol: validation.data.symbol,
            dataType: typeof data
          });
        },
        onError: (error) => {
          apiLogger.error('Subscription error', error, { subscriptionId });
        }
      });

      apiLogger.info('Subscription created', {
        subscriptionId,
        symbol: validation.data.symbol,
        channels: validation.data.channels
      });

      await reply.send({
        success: true,
        data: {
          subscriptionId,
          symbol: validation.data.symbol,
          channels: validation.data.channels
        }
      });

    } catch (error) {
      apiLogger.error('Failed to create subscription', error as Error, {
        symbol: body.symbol
      });

      await reply.status(500).send({
        success: false,
        error: 'Failed to create subscription'
      });
    }
  });

  // Cancel subscription endpoint
  app.delete('/subscribe/:subscriptionId', {
    schema: {
      description: 'Cancel a WebSocket subscription',
      tags: ['Market Data'],
      params: {
        type: 'object',
        properties: {
          subscriptionId: { type: 'string' }
        },
        required: ['subscriptionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { subscriptionId } = request.params as { subscriptionId: string };

    try {
      const success = marketDataService.unsubscribe(subscriptionId);

      if (!success) {
        return reply.status(404).send({
          success: false,
          error: 'Subscription not found'
        });
      }

      await reply.send({
        success: true,
        message: 'Subscription cancelled successfully'
      });

    } catch (error) {
      apiLogger.error('Failed to cancel subscription', error as Error, { subscriptionId });

      await reply.status(500).send({
        success: false,
        error: 'Failed to cancel subscription'
      });
    }
  });

  // Active subscriptions endpoint
  app.get('/subscriptions', {
    schema: {
      description: 'Get list of active subscriptions',
      tags: ['Market Data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  symbol: { type: 'string' },
                  type: { type: 'string' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const subscriptions = marketDataService.getActiveSubscriptions();

      await reply.send({
        success: true,
        data: subscriptions
      });

    } catch (error) {
      apiLogger.error('Failed to get active subscriptions', error as Error);

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

export default marketDataRoutes;