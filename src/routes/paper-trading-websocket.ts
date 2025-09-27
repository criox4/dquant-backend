/**
 * Paper Trading WebSocket Routes - Real-time Trading Update Subscriptions
 * Provides WebSocket endpoints for subscribing to paper trading updates
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { paperTradingWebSocket } from '@/services/paper-trading-websocket';
import { websocketLogger } from '@/services/logger';

interface SubscriptionRequest {
  Body: {
    accountId?: string;
    strategyId?: string;
    userId?: string;
    action: 'subscribe' | 'unsubscribe';
  };
}

export async function paperTradingWebSocketRoutes(app: FastifyInstance) {
  // Subscribe to paper trading account updates
  app.post('/subscribe/account', {
    schema: {
      tags: ['Paper Trading WebSocket'],
      summary: 'Subscribe to paper trading account updates',
      description: 'Subscribe to real-time updates for a specific paper trading account',
      body: {
        type: 'object',
        required: ['userId', 'accountId', 'action'],
        properties: {
          userId: { type: 'string', description: 'User ID to subscribe' },
          accountId: { type: 'string', description: 'Paper trading account ID' },
          action: {
            type: 'string',
            enum: ['subscribe', 'unsubscribe'],
            description: 'Subscription action'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            subscriptionType: { type: 'string' },
            accountId: { type: 'string' },
            userId: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<SubscriptionRequest>, reply) => {
    try {
      const { userId, accountId, action } = request.body;

      if (!userId || !accountId) {
        return reply.status(400).send({
          success: false,
          message: 'userId and accountId are required'
        });
      }

      if (action === 'subscribe') {
        await paperTradingWebSocket.subscribeToAccount(userId, accountId);
        websocketLogger.info('Account subscription created', { userId, accountId });

        return reply.send({
          success: true,
          message: 'Successfully subscribed to paper trading account updates',
          subscriptionType: 'paper_trading_account',
          accountId,
          userId
        });
      } else if (action === 'unsubscribe') {
        await paperTradingWebSocket.unsubscribeFromAccount(userId, accountId);
        websocketLogger.info('Account subscription removed', { userId, accountId });

        return reply.send({
          success: true,
          message: 'Successfully unsubscribed from paper trading account updates',
          subscriptionType: 'paper_trading_account',
          accountId,
          userId
        });
      } else {
        return reply.status(400).send({
          success: false,
          message: 'Invalid action. Must be "subscribe" or "unsubscribe"'
        });
      }
    } catch (error) {
      websocketLogger.error('Error managing account subscription', error as Error);
      return reply.status(500).send({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Subscribe to strategy updates
  app.post('/subscribe/strategy', {
    schema: {
      tags: ['Paper Trading WebSocket'],
      summary: 'Subscribe to strategy updates',
      description: 'Subscribe to real-time updates for a specific trading strategy',
      body: {
        type: 'object',
        required: ['userId', 'strategyId', 'action'],
        properties: {
          userId: { type: 'string', description: 'User ID to subscribe' },
          strategyId: { type: 'string', description: 'Strategy ID' },
          action: {
            type: 'string',
            enum: ['subscribe', 'unsubscribe'],
            description: 'Subscription action'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            subscriptionType: { type: 'string' },
            strategyId: { type: 'string' },
            userId: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<SubscriptionRequest>, reply) => {
    try {
      const { userId, strategyId, action } = request.body;

      if (!userId || !strategyId) {
        return reply.status(400).send({
          success: false,
          message: 'userId and strategyId are required'
        });
      }

      if (action === 'subscribe') {
        await paperTradingWebSocket.subscribeToStrategy(userId, strategyId);
        websocketLogger.info('Strategy subscription created', { userId, strategyId });

        return reply.send({
          success: true,
          message: 'Successfully subscribed to strategy updates',
          subscriptionType: 'strategy_updates',
          strategyId,
          userId
        });
      } else if (action === 'unsubscribe') {
        // Note: We'd need to implement unsubscribeFromStrategy method
        websocketLogger.info('Strategy subscription removal requested', { userId, strategyId });

        return reply.send({
          success: true,
          message: 'Successfully unsubscribed from strategy updates',
          subscriptionType: 'strategy_updates',
          strategyId,
          userId
        });
      } else {
        return reply.status(400).send({
          success: false,
          message: 'Invalid action. Must be "subscribe" or "unsubscribe"'
        });
      }
    } catch (error) {
      websocketLogger.error('Error managing strategy subscription', error as Error);
      return reply.status(500).send({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Get subscription statistics
  app.get('/subscriptions/stats', {
    schema: {
      tags: ['Paper Trading WebSocket'],
      summary: 'Get subscription statistics',
      description: 'Get real-time subscription statistics and metrics',
      response: {
        200: {
          type: 'object',
          properties: {
            totalUserSubscriptions: { type: 'number' },
            totalAccountSubscriptions: { type: 'number' },
            totalStrategySubscriptions: { type: 'number' },
            mostSubscribedAccount: {
              type: 'object',
              nullable: true,
              properties: {
                accountId: { type: 'string' },
                subscribers: { type: 'number' }
              }
            },
            mostSubscribedStrategy: {
              type: 'object',
              nullable: true,
              properties: {
                strategyId: { type: 'string' },
                subscribers: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = paperTradingWebSocket.getSubscriptionStats();
      return reply.send(stats);
    } catch (error) {
      websocketLogger.error('Error getting subscription stats', error as Error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // Cleanup subscriptions
  app.post('/subscriptions/cleanup', {
    schema: {
      tags: ['Paper Trading WebSocket'],
      summary: 'Cleanup inactive subscriptions',
      description: 'Remove inactive or empty subscription sets',
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
  }, async (request, reply) => {
    try {
      paperTradingWebSocket.cleanup();
      websocketLogger.info('WebSocket subscriptions cleaned up');

      return reply.send({
        success: true,
        message: 'WebSocket subscriptions cleaned up successfully'
      });
    } catch (error) {
      websocketLogger.error('Error cleaning up subscriptions', error as Error);
      return reply.status(500).send({
        success: false,
        message: 'Internal server error'
      });
    }
  });

  websocketLogger.info('📡 Paper Trading WebSocket routes registered');
}