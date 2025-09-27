/**
 * Backtest API Routes - Historical Strategy Testing Endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  BacktestConfiguration
} from '@/types/backtest';
import { backtestingEngine } from '@/services/backtesting-engine';
import { apiLogger } from '@/services/logger';

// Zod schemas for request validation
const backtestRequestSchema = z.object({
  strategyId: z.string().min(1, 'Strategy ID is required'),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
    errorMap: () => ({ message: 'Invalid timeframe' })
  }),
  startDate: z.string().or(z.date()).transform(val => new Date(val)),
  endDate: z.string().or(z.date()).transform(val => new Date(val)),
  initialCapital: z.number().positive('Initial capital must be positive'),
  commission: z.number().min(0).max(1).optional().default(0.001),
  slippage: z.number().min(0).max(1).optional().default(0.0001),
  maxPositions: z.number().int().positive().optional().default(1),
  riskPerTrade: z.number().min(0).max(1).optional().default(0.01),
  parameters: z.record(z.any()).optional().default({})
});

const backtestQuerySchema = z.object({
  strategyId: z.string().optional(),
  symbol: z.string().optional(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  sortBy: z.enum(['createdAt', 'performance', 'drawdown']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

async function backtestRoutes(app: FastifyInstance): Promise<void> {
  // Create new backtest endpoint
  app.post('/', {
    schema: {
      description: 'Create and run a new backtest',
      tags: ['Backtest'],
      body: {
        type: 'object',
        properties: {
          strategyId: { type: 'string', description: 'Strategy ID to backtest' },
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTC/USDT)' },
          timeframe: {
            type: 'string',
            enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
            description: 'Candlestick timeframe'
          },
          startDate: { type: 'string', format: 'date-time', description: 'Backtest start date' },
          endDate: { type: 'string', format: 'date-time', description: 'Backtest end date' },
          initialCapital: { type: 'number', minimum: 1, description: 'Initial capital amount' },
          commission: { type: 'number', minimum: 0, maximum: 1, description: 'Commission rate (default: 0.001)' },
          slippage: { type: 'number', minimum: 0, maximum: 1, description: 'Slippage rate (default: 0.0001)' },
          maxPositions: { type: 'integer', minimum: 1, description: 'Maximum concurrent positions' },
          riskPerTrade: { type: 'number', minimum: 0, maximum: 1, description: 'Risk per trade as percentage of equity' },
          parameters: { type: 'object', description: 'Strategy-specific parameters' }
        },
        required: ['strategyId', 'symbol', 'timeframe', 'startDate', 'endDate', 'initialCapital']
      },
      response: {
        201: {
          description: 'Backtest created and started successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                backtestId: { type: 'string' },
                status: { type: 'string' },
                configuration: { type: 'object' },
                estimatedDuration: { type: 'number' }
              }
            }
          }
        },
        400: {
          description: 'Invalid request parameters',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            details: { type: 'array' }
          }
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    try {
      const validation = backtestRequestSchema.safeParse(body);

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request parameters',
          details: validation.error.issues
        });
      }

      const backtestData = validation.data;

      // Validate date range
      if (backtestData.endDate <= backtestData.startDate) {
        return reply.status(400).send({
          success: false,
          error: 'End date must be after start date'
        });
      }

      // Validate date is not too far in the future
      if (backtestData.endDate > new Date()) {
        return reply.status(400).send({
          success: false,
          error: 'End date cannot be in the future'
        });
      }

      apiLogger.info('Creating new backtest', {
        strategyId: backtestData.strategyId,
        symbol: backtestData.symbol,
        timeframe: backtestData.timeframe,
        period: `${backtestData.startDate.toISOString()} to ${backtestData.endDate.toISOString()}`,
        initialCapital: backtestData.initialCapital
      });

      // Create backtest configuration
      const config: BacktestConfiguration = {
        strategyId: backtestData.strategyId,
        symbol: backtestData.symbol,
        timeframe: backtestData.timeframe,
        startDate: backtestData.startDate,
        endDate: backtestData.endDate,
        initialCapital: backtestData.initialCapital,
        commission: backtestData.commission,
        slippage: backtestData.slippage,
        maxPositions: backtestData.maxPositions,
        riskPerTrade: backtestData.riskPerTrade,
        parameters: backtestData.parameters
      };

      // Start backtest (async operation)
      backtestingEngine.runBacktest(config)
        .then(result => {
          apiLogger.info('Backtest completed successfully', {
            backtestId: result.backtestId,
            totalReturn: result.performance.totalReturnPercentage,
            maxDrawdown: result.performance.maxDrawdownPercentage,
            totalTrades: result.performance.totalTrades
          });
        })
        .catch(error => {
          apiLogger.error('Backtest failed', error as Error, {
            strategyId: config.strategyId,
            symbol: config.symbol
          });
        });

      await reply.status(201).send({
        success: true,
        data: {
          backtestId: 'pending', // Will be set when backtest starts
          status: 'RUNNING',
          configuration: config,
          estimatedDuration: 0 // Estimated in milliseconds
        }
      });

    } catch (error) {
      apiLogger.error('Failed to create backtest', error as Error, {
        requestBody: body
      });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create backtest'
      });
    }
  });

  // Get specific backtest by ID
  app.get('/:backtestId', {
    schema: {
      description: 'Get backtest details by ID',
      tags: ['Backtest'],
      params: {
        type: 'object',
        properties: {
          backtestId: { type: 'string', description: 'Backtest ID' }
        },
        required: ['backtestId']
      },
      response: {
        200: {
          description: 'Backtest details retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                backtestId: { type: 'string' },
                strategyId: { type: 'string' },
                symbol: { type: 'string' },
                status: { type: 'string' },
                performance: { type: 'object' },
                configuration: { type: 'object' },
                trades: { type: 'array' },
                positions: { type: 'array' },
                equityCurve: { type: 'array' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' }
              }
            }
          }
        },
        404: {
          description: 'Backtest not found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { backtestId } = request.params as { backtestId: string };

    try {
      const backtest = await backtestingEngine.getBacktest(backtestId);

      if (!backtest) {
        return reply.status(404).send({
          success: false,
          error: 'Backtest not found'
        });
      }

      await reply.send({
        success: true,
        data: backtest
      });

    } catch (error) {
      apiLogger.error('Failed to get backtest', error as Error, { backtestId });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve backtest'
      });
    }
  });

  // Get backtest progress (for running backtests)
  app.get('/:backtestId/progress', {
    schema: {
      description: 'Get real-time backtest progress',
      tags: ['Backtest'],
      params: {
        type: 'object',
        properties: {
          backtestId: { type: 'string', description: 'Backtest ID' }
        },
        required: ['backtestId']
      },
      response: {
        200: {
          description: 'Backtest progress retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                backtestId: { type: 'string' },
                percentage: { type: 'number' },
                currentCandle: { type: 'number' },
                totalCandles: { type: 'number' },
                currentDate: { type: 'string' },
                status: { type: 'string' },
                currentEquity: { type: 'number' },
                currentDrawdown: { type: 'number' },
                recentTrades: { type: 'array' }
              }
            }
          }
        },
        404: {
          description: 'Backtest not found or not running',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { backtestId } = request.params as { backtestId: string };

    try {
      // Get running backtest progress
      const progress = (backtestingEngine as any).runningBacktests?.get(backtestId);

      if (!progress) {
        return reply.status(404).send({
          success: false,
          error: 'Backtest not found or not currently running'
        });
      }

      await reply.send({
        success: true,
        data: progress
      });

    } catch (error) {
      apiLogger.error('Failed to get backtest progress', error as Error, { backtestId });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Cancel running backtest
  app.delete('/:backtestId', {
    schema: {
      description: 'Cancel a running backtest',
      tags: ['Backtest'],
      params: {
        type: 'object',
        properties: {
          backtestId: { type: 'string', description: 'Backtest ID' }
        },
        required: ['backtestId']
      },
      response: {
        200: {
          description: 'Backtest cancelled successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          description: 'Backtest not found or not running',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { backtestId } = request.params as { backtestId: string };

    try {
      const cancelled = await backtestingEngine.cancelBacktest(backtestId);

      if (!cancelled) {
        return reply.status(404).send({
          success: false,
          error: 'Backtest not found or not currently running'
        });
      }

      apiLogger.info('Backtest cancelled', { backtestId });

      await reply.send({
        success: true,
        message: 'Backtest cancelled successfully'
      });

    } catch (error) {
      apiLogger.error('Failed to cancel backtest', error as Error, { backtestId });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // List backtests with filtering and pagination
  app.get('/', {
    schema: {
      description: 'List backtests with filtering and pagination',
      tags: ['Backtest'],
      querystring: {
        type: 'object',
        properties: {
          strategyId: { type: 'string', description: 'Filter by strategy ID' },
          symbol: { type: 'string', description: 'Filter by trading symbol' },
          status: {
            type: 'string',
            enum: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
            description: 'Filter by backtest status'
          },
          limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Number of results per page' },
          offset: { type: 'integer', minimum: 0, description: 'Number of results to skip' },
          sortBy: {
            type: 'string',
            enum: ['createdAt', 'performance', 'drawdown'],
            description: 'Sort field'
          },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' }
        }
      },
      response: {
        200: {
          description: 'Backtests retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                backtests: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      backtestId: { type: 'string' },
                      strategyId: { type: 'string' },
                      symbol: { type: 'string' },
                      status: { type: 'string' },
                      performance: { type: 'object' },
                      createdAt: { type: 'string' }
                    }
                  }
                },
                total: { type: 'number' },
                limit: { type: 'number' },
                offset: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    try {
      const validation = backtestQuerySchema.safeParse(query);

      if (!validation.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.issues
        });
      }

      const { limit, offset } = validation.data;

      // Build database query with filters
      const whereClause: any = {};

      if (validation.data.strategyId) {
        whereClause.strategyId = validation.data.strategyId;
      }

      if (validation.data.symbol) {
        whereClause.symbol = validation.data.symbol;
      }

      if (validation.data.status) {
        whereClause.status = validation.data.status;
      }

      // Query backtest results from database
      const [backtests, total] = await Promise.all([
        app.prisma.backtestResult.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            strategyId: true,
            symbol: true,
            status: true,
            results: true, // JSON field containing performance metrics
            createdAt: true,
            updatedAt: true,
          }
        }),
        app.prisma.backtestResult.count({
          where: whereClause
        })
      ]);

      // Transform results to match expected format
      const formattedBacktests = backtests.map(bt => ({
        id: bt.id,
        backtestId: bt.id, // Use same ID for compatibility
        strategyId: bt.strategyId,
        symbol: bt.symbol,
        status: bt.status,
        performance: bt.results ? {
          totalReturnPercentage: (bt.results as any)?.totalReturn || 0,
          maxDrawdownPercentage: (bt.results as any)?.maxDrawdown || 0,
          sharpeRatio: (bt.results as any)?.sharpeRatio || 0,
          totalTrades: (bt.results as any)?.totalTrades || 0
        } : null,
        createdAt: bt.createdAt.toISOString(),
        updatedAt: bt.updatedAt.toISOString()
      }));

      await reply.send({
        success: true,
        data: {
          backtests: formattedBacktests,
          total,
          limit,
          offset
        }
      });

    } catch (error) {
      apiLogger.error('Failed to list backtests', error as Error, { query });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Get backtesting engine statistics
  app.get('/stats', {
    schema: {
      description: 'Get backtesting engine statistics',
      tags: ['Backtest'],
      response: {
        200: {
          description: 'Statistics retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalBacktests: { type: 'number' },
                runningBacktests: { type: 'number' },
                completedBacktests: { type: 'number' },
                failedBacktests: { type: 'number' },
                averageExecutionTime: { type: 'number' },
                averagePerformance: { type: 'object' },
                topPerformers: { type: 'array' }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await backtestingEngine.getStatistics();

      await reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      apiLogger.error('Failed to get backtest statistics', error as Error);

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Compare multiple backtests
  app.post('/compare', {
    schema: {
      description: 'Compare multiple backtests',
      tags: ['Backtest'],
      body: {
        type: 'object',
        properties: {
          backtestIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 10,
            description: 'List of backtest IDs to compare'
          },
          metrics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['return', 'sharpe', 'drawdown', 'winRate', 'volatility']
            },
            description: 'Metrics to compare'
          }
        },
        required: ['backtestIds']
      },
      response: {
        200: {
          description: 'Comparison completed successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                comparison: { type: 'object' },
                summary: { type: 'object' },
                rankings: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    try {
      const { backtestIds } = body;

      // Validate backtest IDs
      if (!Array.isArray(backtestIds) || backtestIds.length < 2) {
        return reply.status(400).send({
          success: false,
          error: 'At least 2 backtest IDs are required for comparison'
        });
      }

      // For now, return mock comparison data
      const comparison = {
        backtests: backtestIds,
        metrics: {
          return: backtestIds.map(() => Math.random() * 20 - 5),
          sharpe: backtestIds.map(() => Math.random() * 3),
          drawdown: backtestIds.map(() => -(Math.random() * 20))
        },
        summary: {
          bestReturn: backtestIds[0],
          bestSharpe: backtestIds[1],
          bestDrawdown: backtestIds[0]
        }
      };

      await reply.send({
        success: true,
        data: comparison
      });

    } catch (error) {
      apiLogger.error('Failed to compare backtests', error as Error, { body });

      await reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}

export default backtestRoutes;