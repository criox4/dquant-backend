import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { apiLogger, tradingLogger } from '@/services/logger';
import { PaperTradingService } from '@/services/paper-trading-service';
import {
  CreatePaperAccountRequest,
  UpdatePaperAccountRequest,
  CreatePaperOrderRequest,
  CancelPaperOrderRequest,
  GetPaperPositionsRequest,
  GetPaperTradesRequest,
  PaperAccountResponse,
  PaperAccountListResponse,
  PaperOrderResponse,
  PaperPortfolioResponse,
  PaperPositionsResponse,
  PaperTradesResponse,
  PaperPerformanceResponse,
  PaperTradingSignal
} from '@/types/paper-trading';

let paperTradingService: PaperTradingService;

export default async function paperTradingRoutes(app: FastifyInstance): Promise<void> {
  try {
    apiLogger.info('Setting up paper trading routes');

    paperTradingService = new PaperTradingService();
    await paperTradingService.initialize();

    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      request.log = apiLogger;
    });

    app.get('/accounts', {
      schema: {
        description: 'Get all paper trading accounts for user',
        tags: ['Paper Trading'],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
            isActive: { type: 'boolean' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  accounts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        name: { type: 'string' },
                        initialBalance: { type: 'number' },
                        currentBalance: { type: 'number' },
                        totalEquity: { type: 'number' },
                        totalPnL: { type: 'number' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string' },
                        updatedAt: { type: 'string' }
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
    }, async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
      try {
        const { limit = 50, offset = 0, isActive } = request.query;
        const userId = 'user-1'; // TODO: Get from JWT token

        const accounts = await paperTradingService.getUserAccounts(userId, { limit, offset, isActive });
        const total = accounts.length; // TODO: Get actual total count

        const response: PaperAccountListResponse = {
          success: true,
          data: {
            accounts,
            total,
            limit,
            offset
          }
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading accounts', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading accounts'
        });
      }
    });

    app.post('/accounts', {
      schema: {
        description: 'Create new paper trading account',
        tags: ['Paper Trading'],
        body: {
          type: 'object',
          required: ['name', 'initialBalance'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            initialBalance: { type: 'number', minimum: 1000 },
            currency: { type: 'string', default: 'USD' },
            leverage: { type: 'number', minimum: 1, maximum: 100, default: 1 },
            riskSettings: {
              type: 'object',
              properties: {
                maxDailyLoss: { type: 'number' },
                maxDailyLossPercentage: { type: 'number' },
                maxPositionSize: { type: 'number' },
                maxPositionSizePercentage: { type: 'number' },
                maxOpenPositions: { type: 'number' },
                stopLossRequired: { type: 'boolean' },
                takeProfitRequired: { type: 'boolean' }
              }
            }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  name: { type: 'string' },
                  initialBalance: { type: 'number' },
                  currentBalance: { type: 'number' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest<CreatePaperAccountRequest>, reply: FastifyReply) => {
      try {
        const userId = 'user-1'; // TODO: Get from JWT token
        const { body } = request;

        const account = await paperTradingService.createAccount(userId, body);

        tradingLogger.info('Paper trading account created', {
          accountId: account.id,
          userId,
          initialBalance: account.initialBalance
        });

        const response: PaperAccountResponse = {
          success: true,
          data: account
        };

        await reply.status(201).send(response);
      } catch (error) {
        apiLogger.error('Failed to create paper trading account', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to create paper trading account'
        });
      }
    });

    app.get('/accounts/:accountId', {
      schema: {
        description: 'Get paper trading account by ID',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  currentBalance: { type: 'number' },
                  totalEquity: { type: 'number' },
                  totalPnL: { type: 'number' },
                  statistics: { type: 'object' },
                  riskSettings: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;

        const account = await paperTradingService.getAccount(accountId);
        if (!account) {
          await reply.status(404).send({
            success: false,
            message: 'Paper trading account not found'
          });
          return;
        }

        const response: PaperAccountResponse = {
          success: true,
          data: account
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading account', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading account'
        });
      }
    });

    app.put('/accounts/:accountId', {
      schema: {
        description: 'Update paper trading account',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            isActive: { type: 'boolean' },
            riskSettings: {
              type: 'object',
              properties: {
                maxDailyLoss: { type: 'number' },
                maxDailyLossPercentage: { type: 'number' },
                maxPositionSize: { type: 'number' },
                maxPositionSizePercentage: { type: 'number' },
                maxOpenPositions: { type: 'number' }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest<UpdatePaperAccountRequest>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const { body } = request;

        const account = await paperTradingService.updateAccount(accountId, body);
        if (!account) {
          await reply.status(404).send({
            success: false,
            message: 'Paper trading account not found'
          });
          return;
        }

        const response: PaperAccountResponse = {
          success: true,
          data: account
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to update paper trading account', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to update paper trading account'
        });
      }
    });

    app.get('/accounts/:accountId/portfolio', {
      schema: {
        description: 'Get paper trading portfolio',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;

        const portfolio = await paperTradingService.getPortfolio(accountId);
        if (!portfolio) {
          await reply.status(404).send({
            success: false,
            message: 'Paper trading portfolio not found'
          });
          return;
        }

        const response: PaperPortfolioResponse = {
          success: true,
          data: portfolio
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading portfolio', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading portfolio'
        });
      }
    });

    app.post('/accounts/:accountId/orders', {
      schema: {
        description: 'Create new paper trading order',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['symbol', 'side', 'type', 'quantity'],
          properties: {
            symbol: { type: 'string', minLength: 1 },
            side: { type: 'string', enum: ['BUY', 'SELL'] },
            type: { type: 'string', enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] },
            quantity: { type: 'number', minimum: 0.01 },
            price: { type: 'number', minimum: 0 },
            stopPrice: { type: 'number', minimum: 0 },
            timeInForce: { type: 'string', enum: ['GTC', 'IOC', 'FOK'], default: 'GTC' },
            reduceOnly: { type: 'boolean', default: false },
            closePosition: { type: 'boolean', default: false },
            clientOrderId: { type: 'string' },
            strategyId: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<CreatePaperOrderRequest>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const { body } = request;

        const order = await paperTradingService.createOrder(accountId, body);

        tradingLogger.logTradeExecuted(order.id, {
          accountId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          type: order.type
        });

        const response: PaperOrderResponse = {
          success: true,
          data: order
        };

        await reply.status(201).send(response);
      } catch (error) {
        apiLogger.error('Failed to create paper trading order', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to create paper trading order'
        });
      }
    });

    app.delete('/accounts/:accountId/orders/:orderId', {
      schema: {
        description: 'Cancel paper trading order',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId', 'orderId'],
          properties: {
            accountId: { type: 'string' },
            orderId: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<CancelPaperOrderRequest>, reply: FastifyReply) => {
      try {
        const { accountId, orderId } = request.params;

        const success = await paperTradingService.cancelOrder(accountId, orderId);
        if (!success) {
          await reply.status(404).send({
            success: false,
            message: 'Order not found or cannot be canceled'
          });
          return;
        }

        await reply.send({
          success: true,
          message: 'Order canceled successfully'
        });
      } catch (error) {
        apiLogger.error('Failed to cancel paper trading order', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to cancel paper trading order'
        });
      }
    });

    app.get('/accounts/:accountId/orders', {
      schema: {
        description: 'Get paper trading orders',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            status: { type: 'string', enum: ['NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'] },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string }; Querystring: any }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const filters = request.query;

        const orders = await paperTradingService.getOrders(accountId, filters);

        await reply.send({
          success: true,
          data: {
            orders,
            total: orders.length
          }
        });
      } catch (error) {
        apiLogger.error('Failed to get paper trading orders', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading orders'
        });
      }
    });

    app.get('/accounts/:accountId/positions', {
      schema: {
        description: 'Get paper trading positions',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
            strategyId: { type: 'string' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        }
      }
    }, async (request: FastifyRequest<GetPaperPositionsRequest>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const filters = request.query;

        const positions = await paperTradingService.getPositions(accountId, filters);
        const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
        const totalMargin = positions.reduce((sum, pos) => sum + pos.margin, 0);

        const response: PaperPositionsResponse = {
          success: true,
          data: {
            positions,
            total: positions.length,
            unrealizedPnL: totalUnrealizedPnL,
            totalMargin
          }
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading positions', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading positions'
        });
      }
    });

    app.delete('/accounts/:accountId/positions/:positionId', {
      schema: {
        description: 'Close paper trading position',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId', 'positionId'],
          properties: {
            accountId: { type: 'string' },
            positionId: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string; positionId: string } }>, reply: FastifyReply) => {
      try {
        const { accountId, positionId } = request.params;

        const success = await paperTradingService.closePosition(accountId, positionId);
        if (!success) {
          await reply.status(404).send({
            success: false,
            message: 'Position not found or cannot be closed'
          });
          return;
        }

        tradingLogger.logPositionClosed(positionId, { accountId });

        await reply.send({
          success: true,
          message: 'Position closed successfully'
        });
      } catch (error) {
        apiLogger.error('Failed to close paper trading position', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to close paper trading position'
        });
      }
    });

    app.get('/accounts/:accountId/trades', {
      schema: {
        description: 'Get paper trading trade history',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        querystring: {
          type: 'object',
          properties: {
            symbol: { type: 'string' },
            strategyId: { type: 'string' },
            startTime: { type: 'number' },
            endTime: { type: 'number' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 }
          }
        }
      }
    }, async (request: FastifyRequest<GetPaperTradesRequest>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const filters = request.query;

        const trades = await paperTradingService.getTrades(accountId, filters);
        const totalVolume = trades.reduce((sum, trade) => sum + trade.quoteQuantity, 0);
        const totalCommission = trades.reduce((sum, trade) => sum + trade.commission, 0);

        const response: PaperTradesResponse = {
          success: true,
          data: {
            trades,
            total: trades.length,
            totalVolume,
            totalCommission
          }
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading trades', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading trades'
        });
      }
    });

    app.get('/accounts/:accountId/performance', {
      schema: {
        description: 'Get paper trading performance analytics',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;

        const performance = await paperTradingService.getPerformance(accountId);
        if (!performance) {
          await reply.status(404).send({
            success: false,
            message: 'Performance data not found'
          });
          return;
        }

        // Mock additional performance data for now
        const dailyPnL = []; // TODO: Implement daily P&L calculation
        const equityCurve = []; // TODO: Implement equity curve calculation
        const strategies = []; // TODO: Get strategy performance

        const response: PaperPerformanceResponse = {
          success: true,
          data: {
            account: performance,
            strategies,
            dailyPnL,
            equityCurve
          }
        };

        await reply.send(response);
      } catch (error) {
        apiLogger.error('Failed to get paper trading performance', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to get paper trading performance'
        });
      }
    });

    app.post('/accounts/:accountId/signals', {
      schema: {
        description: 'Process trading signal for paper trading account',
        tags: ['Paper Trading'],
        params: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          required: ['strategyId', 'strategyName', 'symbol', 'action', 'reason', 'confidence'],
          properties: {
            strategyId: { type: 'string' },
            strategyName: { type: 'string' },
            symbol: { type: 'string' },
            action: { type: 'string', enum: ['BUY', 'SELL', 'CLOSE', 'CLOSE_LONG', 'CLOSE_SHORT'] },
            type: { type: 'string', enum: ['MARKET', 'LIMIT'], default: 'MARKET' },
            quantity: { type: 'number', minimum: 0 },
            price: { type: 'number', minimum: 0 },
            percentage: { type: 'number', minimum: 0, maximum: 100 },
            stopLoss: { type: 'number', minimum: 0 },
            takeProfit: { type: 'number', minimum: 0 },
            leverage: { type: 'number', minimum: 1, maximum: 100 },
            reason: { type: 'string', minLength: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            metadata: { type: 'object' }
          }
        }
      }
    }, async (request: FastifyRequest<{ Params: { accountId: string }; Body: PaperTradingSignal }>, reply: FastifyReply) => {
      try {
        const { accountId } = request.params;
        const signal: PaperTradingSignal = {
          ...request.body,
          timestamp: new Date()
        };

        const order = await paperTradingService.processSignal(accountId, signal);

        if (order) {
          tradingLogger.info('Trading signal processed successfully', {
            accountId,
            strategyId: signal.strategyId,
            symbol: signal.symbol,
            action: signal.action,
            orderId: order.id
          });

          await reply.status(201).send({
            success: true,
            data: {
              order,
              signal
            },
            message: 'Trading signal processed successfully'
          });
        } else {
          await reply.status(400).send({
            success: false,
            message: 'Trading signal could not be processed'
          });
        }
      } catch (error) {
        apiLogger.error('Failed to process trading signal', error as Error);
        await reply.status(500).send({
          success: false,
          message: 'Failed to process trading signal'
        });
      }
    });

    apiLogger.info('Paper trading routes setup completed');

  } catch (error) {
    apiLogger.error('Failed to setup paper trading routes', error as Error);
    throw error;
  }
}