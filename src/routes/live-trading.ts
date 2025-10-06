/**
 * Live Trading API Routes
 * RESTful endpoints for live trading operations with Binance
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { binanceLiveTradingService } from '@/services/binance-live-trading';
import { tradingLogger } from '@/services/logger';
import {
  LiveOrderParams
} from '@/types/live-trading';

// Request/Response Types removed - using FastifyRequest directly

// CreateOrderRequest interface removed - using FastifyRequest directly

// CancelOrderRequest interface removed - using FastifyRequest directly

// GetOrderRequest interface removed - using FastifyRequest directly

// GetOrdersRequest interface removed - using FastifyRequest directly

// GetPositionsRequest interface removed - using FastifyRequest directly

// All request interfaces removed - using FastifyRequest directly with type assertions

// All remaining request interfaces removed - using FastifyRequest directly with type assertions

export default async function liveTradingRoutes(app: FastifyInstance): Promise<void> {
  // OpenAPI Tags
  const tags = ['Live Trading'];

  // 1. Connection and Status
  app.get('/status', {
    schema: {
      summary: 'Get live trading system status',
      description: 'Retrieve overall live trading system status and health information',
      tags,
      response: {
        200: {
          description: 'System status retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isConnected: { type: 'boolean' },
                exchange: { type: 'string' },
                status: { type: 'string', enum: ['ok', 'maintenance', 'error'] },
                serverTime: { type: 'string', format: 'date-time' },
                marketsLoaded: { type: 'number' },
                lastUpdate: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isConnected = binanceLiveTradingService.isConnected();
      const status = await binanceLiveTradingService.getStatus();
      const markets = await binanceLiveTradingService.getMarkets();

      await reply.status(200).send({
        success: true,
        data: {
          isConnected,
          exchange: 'binance',
          status: status.status,
          serverTime: new Date().toISOString(),
          marketsLoaded: Object.keys(markets).length,
          lastUpdate: new Date(status.updated).toISOString()
        }
      });

    } catch (error) {
      tradingLogger.error('Failed to get system status', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve system status'
      });
    }
  });

  // 2. Connect to Exchange
  app.post('/connect', {
    schema: {
      summary: 'Connect to exchange',
      description: 'Establish connection to Binance exchange',
      tags,
      response: {
        200: {
          description: 'Connected successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const connected = await binanceLiveTradingService.connect();

      await reply.status(200).send({
        success: connected,
        message: connected ? 'Connected to Binance successfully' : 'Failed to connect',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      tradingLogger.error('Failed to connect to exchange', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // 3. Disconnect from Exchange
  app.post('/disconnect', {
    schema: {
      summary: 'Disconnect from exchange',
      description: 'Disconnect from Binance exchange and close all connections',
      tags,
      response: {
        200: {
          description: 'Disconnected successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await binanceLiveTradingService.disconnect();

      await reply.status(200).send({
        success: true,
        message: 'Disconnected from Binance successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      tradingLogger.error('Failed to disconnect from exchange', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // 4. Get Account Balance
  app.get('/balance', {
    schema: {
      summary: 'Get account balance',
      description: 'Retrieve current account balance and margin information',
      tags,
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['spot', 'future', 'margin'], description: 'Account type' },
          currency: { type: 'string', description: 'Specific currency to retrieve' }
        }
      },
      response: {
        200: {
          description: 'Balance retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                free: { type: 'object' },
                used: { type: 'object' },
                total: { type: 'object' },
                info: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { type, currency } = request.query as { type?: 'spot' | 'future' | 'margin', currency?: string };
      const balance = await binanceLiveTradingService.getBalance({ type, currency });

      await reply.status(200).send({
        success: true,
        data: balance
      });

    } catch (error) {
      tradingLogger.error('Failed to get balance', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve balance'
      });
    }
  });

  // 5. Get Account Information
  app.get('/account', {
    schema: {
      summary: 'Get account information',
      description: 'Retrieve detailed account information including permissions and risk settings',
      tags,
      response: {
        200: {
          description: 'Account information retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                exchangeName: { type: 'string' },
                accountType: { type: 'string' },
                isActive: { type: 'boolean' },
                balance: { type: 'object' },
                permissions: { type: 'array', items: { type: 'string' } },
                riskConfig: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const account = await binanceLiveTradingService.getAccount();

      await reply.status(200).send({
        success: true,
        data: account
      });

    } catch (error) {
      tradingLogger.error('Failed to get account info', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve account information'
      });
    }
  });

  // 6. Create Order
  app.post('/orders', {
    schema: {
      summary: 'Create new order',
      description: 'Place a new trading order on Binance',
      tags,
      body: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol (e.g., BTCUSDT)' },
          type: { type: 'string', enum: ['market', 'limit', 'stop', 'stop_limit'], description: 'Order type' },
          side: { type: 'string', enum: ['buy', 'sell'], description: 'Order side' },
          amount: { type: 'number', minimum: 0.001, description: 'Order amount' },
          price: { type: 'number', minimum: 0.001, description: 'Order price (for limit orders)' },
          stopPrice: { type: 'number', description: 'Stop price (for stop orders)' },
          timeInForce: { type: 'string', enum: ['GTC', 'IOC', 'FOK'], description: 'Time in force' },
          reduceOnly: { type: 'boolean', description: 'Reduce only flag' },
          postOnly: { type: 'boolean', description: 'Post only flag' },
          clientOrderId: { type: 'string', description: 'Client order ID' },
          leverageRate: { type: 'number', description: 'Leverage rate' },
          marginMode: { type: 'string', enum: ['cross', 'isolated'], description: 'Margin mode' }
        },
        required: ['symbol', 'type', 'side', 'amount']
      },
      response: {
        200: {
          description: 'Order created successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                symbol: { type: 'string' },
                type: { type: 'string' },
                side: { type: 'string' },
                amount: { type: 'number' },
                price: { type: 'number' },
                filled: { type: 'number' },
                remaining: { type: 'number' },
                cost: { type: 'number' },
                status: { type: 'string' },
                timestamp: { type: 'number' },
                datetime: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const orderParams: LiveOrderParams = {
        symbol: body.symbol,
        type: body.type,
        side: body.side,
        amount: body.amount,
        price: body.price,
        stopPrice: body.stopPrice,
        timeInForce: body.timeInForce,
        reduceOnly: body.reduceOnly,
        postOnly: body.postOnly,
        clientOrderId: body.clientOrderId,
        leverageRate: body.leverageRate,
        marginMode: body.marginMode
      };

      const order = await binanceLiveTradingService.createOrder(orderParams);

      await reply.status(200).send({
        success: true,
        data: order
      });

    } catch (error) {
      tradingLogger.error('Failed to create order', { error: (error as Error).message, body: request.body });

      let statusCode = 500;
      if ((error as Error).name === 'RiskManagementError') statusCode = 400;
      else if ((error as Error).name === 'InsufficientFundsError') statusCode = 400;
      else if ((error as Error).name === 'InvalidOrderError') statusCode = 400;

      await reply.status(statusCode).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // 7. Cancel Order
  app.delete('/orders/:orderId', {
    schema: {
      summary: 'Cancel order',
      description: 'Cancel an existing order',
      tags,
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID to cancel' }
        },
        required: ['orderId']
      },
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      response: {
        200: {
          description: 'Order cancelled successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const { symbol } = request.query as { symbol: string };

      const order = await binanceLiveTradingService.cancelOrder(orderId, symbol);

      await reply.status(200).send({
        success: true,
        data: order
      });

    } catch (error) {
      tradingLogger.error('Failed to cancel order', { error: (error as Error).message, params: request.params });
      await reply.status(500).send({
        success: false,
        error: 'Failed to cancel order'
      });
    }
  });

  // 8. Get Order
  app.get('/orders/:orderId', {
    schema: {
      summary: 'Get order details',
      description: 'Retrieve details of a specific order',
      tags,
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID' }
        },
        required: ['orderId']
      },
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      response: {
        200: {
          description: 'Order details retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { orderId } = request.params as { orderId: string };
      const { symbol } = request.query as { symbol: string };

      const order = await binanceLiveTradingService.getOrder(orderId, symbol);

      await reply.status(200).send({
        success: true,
        data: order
      });

    } catch (error) {
      tradingLogger.error('Failed to get order', { error: (error as Error).message, params: request.params });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve order'
      });
    }
  });

  // 9. Get Orders
  app.get('/orders', {
    schema: {
      summary: 'Get orders',
      description: 'Retrieve list of orders with optional filters',
      tags,
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Filter by symbol' },
          since: { type: 'number', description: 'From timestamp' },
          limit: { type: 'number', minimum: 1, maximum: 1000, description: 'Limit results' }
        }
      },
      response: {
        200: {
          description: 'Orders retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol, since, limit } = request.query as { symbol?: string, since?: number, limit?: number };
      const orders = await binanceLiveTradingService.getOrders(symbol, since, limit);

      await reply.status(200).send({
        success: true,
        data: orders
      });

    } catch (error) {
      tradingLogger.error('Failed to get orders', { error: (error as Error).message, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve orders'
      });
    }
  });

  // 10. Get Open Orders
  app.get('/orders/open', {
    schema: {
      summary: 'Get open orders',
      description: 'Retrieve all currently open orders',
      tags,
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Filter by symbol' }
        }
      },
      response: {
        200: {
          description: 'Open orders retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.query as { symbol?: string };
      const orders = await binanceLiveTradingService.getOpenOrders(symbol);

      await reply.status(200).send({
        success: true,
        data: orders
      });

    } catch (error) {
      tradingLogger.error('Failed to get open orders', { error: (error as Error).message, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve open orders'
      });
    }
  });

  // 11. Get Positions
  app.get('/positions', {
    schema: {
      summary: 'Get positions',
      description: 'Retrieve current trading positions',
      tags,
      querystring: {
        type: 'object',
        properties: {
          symbols: { type: 'string', description: 'Comma-separated list of symbols' }
        }
      },
      response: {
        200: {
          description: 'Positions retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbols } = request.query as { symbols?: string };
      const symbolList = symbols ? symbols.split(',') : undefined;
      const positions = await binanceLiveTradingService.getPositions(symbolList);

      await reply.status(200).send({
        success: true,
        data: positions
      });

    } catch (error) {
      tradingLogger.error('Failed to get positions', { error: (error as Error).message, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve positions'
      });
    }
  });

  // 12. Get Position
  app.get('/positions/:symbol', {
    schema: {
      summary: 'Get position for symbol',
      description: 'Retrieve position details for a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      response: {
        200: {
          description: 'Position retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const position = await binanceLiveTradingService.getPosition(symbol);

      await reply.status(200).send({
        success: true,
        data: position
      });

    } catch (error) {
      tradingLogger.error('Failed to get position', { error: (error as Error).message, params: request.params });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve position'
      });
    }
  });

  // 13. Set Leverage
  app.put('/positions/:symbol/leverage', {
    schema: {
      summary: 'Set leverage for symbol',
      description: 'Set leverage for futures trading on a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      body: {
        type: 'object',
        properties: {
          leverage: { type: 'number', minimum: 1, maximum: 125, description: 'Leverage value' }
        },
        required: ['leverage']
      },
      response: {
        200: {
          description: 'Leverage set successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            symbol: { type: 'string' },
            leverage: { type: 'number' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const { leverage } = request.body as { leverage: number };

      await binanceLiveTradingService.setLeverage(symbol, leverage);

      await reply.status(200).send({
        success: true,
        message: 'Leverage set successfully',
        symbol,
        leverage
      });

    } catch (error) {
      tradingLogger.error('Failed to set leverage', { error: (error as Error).message, params: request.params, body: request.body });

      const statusCode = (error as Error).name === 'RiskManagementError' ? 400 : 500;
      await reply.status(statusCode).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // 14. Set Margin Mode
  app.put('/positions/:symbol/margin-mode', {
    schema: {
      summary: 'Set margin mode for symbol',
      description: 'Set margin mode (cross/isolated) for futures trading on a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      body: {
        type: 'object',
        properties: {
          marginMode: { type: 'string', enum: ['cross', 'isolated'], description: 'Margin mode' }
        },
        required: ['marginMode']
      },
      response: {
        200: {
          description: 'Margin mode set successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            symbol: { type: 'string' },
            marginMode: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const { marginMode } = request.body as { marginMode: 'cross' | 'isolated' };

      await binanceLiveTradingService.setMarginMode(symbol, marginMode);

      await reply.status(200).send({
        success: true,
        message: 'Margin mode set successfully',
        symbol,
        marginMode
      });

    } catch (error) {
      tradingLogger.error('Failed to set margin mode', { error: (error as Error).message, params: request.params, body: request.body });
      await reply.status(500).send({
        success: false,
        error: 'Failed to set margin mode'
      });
    }
  });

  // 15. Get Ticker
  app.get('/market/ticker/:symbol', {
    schema: {
      summary: 'Get ticker for symbol',
      description: 'Retrieve current market ticker data for a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      response: {
        200: {
          description: 'Ticker retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const ticker = await binanceLiveTradingService.getTicker(symbol);

      await reply.status(200).send({
        success: true,
        data: ticker
      });

    } catch (error) {
      tradingLogger.error('Failed to get ticker', { error: (error as Error).message, params: request.params });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve ticker'
      });
    }
  });

  // 16. Get Tickers
  app.get('/market/tickers', {
    schema: {
      summary: 'Get tickers',
      description: 'Retrieve market ticker data for multiple symbols',
      tags,
      querystring: {
        type: 'object',
        properties: {
          symbols: { type: 'string', description: 'Comma-separated list of symbols' }
        }
      },
      response: {
        200: {
          description: 'Tickers retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbols } = request.query as { symbols?: string };
      const symbolList = symbols ? symbols.split(',') : undefined;
      const tickers = await binanceLiveTradingService.getTickers(symbolList);

      await reply.status(200).send({
        success: true,
        data: tickers
      });

    } catch (error) {
      tradingLogger.error('Failed to get tickers', { error: (error as Error).message, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve tickers'
      });
    }
  });

  // 17. Get Order Book
  app.get('/market/orderbook/:symbol', {
    schema: {
      summary: 'Get order book',
      description: 'Retrieve current order book for a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 5, maximum: 1000, description: 'Number of levels' }
        }
      },
      response: {
        200: {
          description: 'Order book retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const { limit } = request.query as { limit?: number };
      const orderbook = await binanceLiveTradingService.getOrderBook(symbol, limit);

      await reply.status(200).send({
        success: true,
        data: orderbook
      });

    } catch (error) {
      tradingLogger.error('Failed to get order book', { error: (error as Error).message, params: request.params });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve order book'
      });
    }
  });

  // 18. Get Candles/OHLCV
  app.get('/market/candles/:symbol', {
    schema: {
      summary: 'Get candles/OHLCV data',
      description: 'Retrieve historical candle data for a specific symbol',
      tags,
      params: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Trading symbol' }
        },
        required: ['symbol']
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', description: 'Timeframe (1m, 5m, 1h, 1d, etc.)', default: '1h' },
          since: { type: 'number', description: 'From timestamp' },
          limit: { type: 'number', minimum: 1, maximum: 1000, description: 'Number of candles' }
        },
        required: ['timeframe']
      },
      response: {
        200: {
          description: 'Candles retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol } = request.params as { symbol: string };
      const { timeframe, since, limit } = request.query as { timeframe: string, since?: number, limit?: number };
      const candles = await binanceLiveTradingService.getCandles(symbol, timeframe, since, limit);

      await reply.status(200).send({
        success: true,
        data: candles
      });

    } catch (error) {
      tradingLogger.error('Failed to get candles', { error: (error as Error).message, params: request.params, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve candles'
      });
    }
  });

  // 19. Get Trading Statistics
  app.get('/stats', {
    schema: {
      summary: 'Get trading statistics',
      description: 'Retrieve comprehensive trading statistics and performance metrics',
      tags,
      response: {
        200: {
          description: 'Statistics retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await binanceLiveTradingService.getStats();

      await reply.status(200).send({
        success: true,
        data: stats
      });

    } catch (error) {
      tradingLogger.error('Failed to get stats', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve trading statistics'
      });
    }
  });

  // 20. Get My Trades
  app.get('/trades', {
    schema: {
      summary: 'Get my trades',
      description: 'Retrieve personal trading history',
      tags,
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Filter by symbol' },
          since: { type: 'number', description: 'From timestamp' },
          limit: { type: 'number', minimum: 1, maximum: 1000, description: 'Limit results' }
        }
      },
      response: {
        200: {
          description: 'Trades retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol, since, limit } = request.query as { symbol?: string, since?: number, limit?: number };
      const trades = await binanceLiveTradingService.getMyTrades(symbol, since, limit);

      await reply.status(200).send({
        success: true,
        data: trades
      });

    } catch (error) {
      tradingLogger.error('Failed to get trades', { error: (error as Error).message, query: request.query });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve trades'
      });
    }
  });

  // 21. Get Active Symbols
  app.get('/active-symbols', {
    schema: {
      summary: 'Get active trading symbols',
      description: 'Get symbols actively being used by running strategies',
      tags,
      response: {
        200: {
          description: 'Active symbols retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            symbols: { type: 'array', items: { type: 'string' } },
            count: { type: 'number' },
            timestamp: { type: 'number' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get symbols from running strategies and open positions
      const positions = await binanceLiveTradingService.getPositions();
      const activeSymbols = positions
        .filter(pos => Math.abs(pos.contracts || 0) > 0)
        .map(pos => pos.symbol);

      // Get unique symbols
      const uniqueSymbols = [...new Set(activeSymbols)];

      tradingLogger.info(`Active symbols request - found: ${uniqueSymbols.join(', ') || 'none'}`);

      await reply.status(200).send({
        success: true,
        symbols: uniqueSymbols,
        count: uniqueSymbols.length,
        timestamp: Date.now()
      });

    } catch (error) {
      tradingLogger.error('Failed to get active symbols', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message,
        symbols: [],
        count: 0
      });
    }
  });

  // 22. Get Dashboard Data
  app.get('/dashboard', {
    schema: {
      summary: 'Get complete dashboard data',
      description: 'Retrieve comprehensive trading dashboard including balance, positions, orders, and strategies',
      tags,
      response: {
        200: {
          description: 'Dashboard data retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            dashboard: { type: 'object' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Fetch all dashboard data in parallel
      const [
        accountInfo,
        positions,
        openOrders,
        recentTrades
      ] = await Promise.all([
        binanceLiveTradingService.getAccount(),
        binanceLiveTradingService.getPositions(),
        binanceLiveTradingService.getOpenOrders(),
        binanceLiveTradingService.getMyTrades(undefined, undefined, 10)
      ]);

      const totalPnl = positions.reduce((sum: number, pos: any) => sum + (pos.unrealizedPnl || 0), 0);
      const positionValue = positions.reduce((sum: number, pos: any) => sum + Math.abs(pos.notional || 0), 0);

      const dashboardData = {
        balance: {
          totalWalletBalance: accountInfo.balance.totalWalletBalance,
          totalMarginBalance: accountInfo.balance.totalMarginBalance,
          availableBalance: accountInfo.balance.availableBalance,
          totalPnl,
          positionValue
        },
        positions: positions.map((pos: any) => ({
          symbol: pos.symbol,
          side: pos.side,
          size: pos.contracts,
          notional: pos.notional,
          entryPrice: pos.entryPrice,
          markPrice: pos.markPrice,
          unrealizedPnl: pos.unrealizedPnl,
          percentage: pos.percentage
        })),
        strategies: [], // TODO: Implement strategy status tracking
        recentTrades: recentTrades.slice(0, 10).map((trade: any) => ({
          timestamp: trade.timestamp,
          symbol: trade.symbol,
          side: trade.side,
          amount: trade.amount,
          price: trade.price,
          pnl: 0 // TODO: Calculate P&L
        })),
        orders: openOrders.map((order: any) => ({
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          amount: order.amount,
          price: order.price,
          status: order.status
        })),
        fundingRates: [], // TODO: Implement funding rate tracking
        summary: {
          totalPositions: positions.length,
          totalOrders: openOrders.length,
          runningStrategies: 0, // TODO: Track running strategies
          totalPnl,
          positionValue,
          marginLevel: 1.0, // TODO: Calculate margin level from account info
          canTrade: accountInfo.isActive
        },
        lastUpdate: Date.now()
      };

      await reply.status(200).send({
        success: true,
        dashboard: dashboardData
      });

    } catch (error) {
      tradingLogger.error('Failed to get dashboard data', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // 23. Get Performance Data
  app.get('/performance', {
    schema: {
      summary: 'Get live trading performance',
      description: 'Get performance data including equity curve and metrics',
      tags,
      response: {
        200: {
          description: 'Performance data retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            performance: { type: 'object' }
          }
        }
      }
    }
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get current account info
      const accountInfo = await binanceLiveTradingService.getAccount();

      // Calculate basic metrics
      const currentBalance = accountInfo.balance.totalWalletBalance || 10000;
      const initialBalance = 10000; // TODO: Store and track initial balance
      const totalPnl = currentBalance - initialBalance;
      const totalPnlPercentage = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

      // Build equity curve (simplified - should come from historical data)
      const equityCurve = [{
        timestamp: Date.now(),
        balance: currentBalance,
        pnl: totalPnl,
        time: new Date().toISOString()
      }];

      // Calculate max drawdown (simplified)
      const maxDrawdown = 0; // TODO: Calculate from historical equity curve

      const performance = {
        currentBalance,
        initialBalance,
        totalPnl,
        totalPnlPercentage,
        maxDrawdown,
        equityCurve,
        trades: 0, // TODO: Track total trades
        winRate: 0, // TODO: Calculate win rate
        profitFactor: 0, // TODO: Calculate profit factor
        sharpeRatio: 0, // TODO: Calculate Sharpe ratio
        lastUpdate: Date.now()
      };

      await reply.status(200).send({
        success: true,
        performance
      });

    } catch (error) {
      tradingLogger.error('Failed to get performance data', { error: (error as Error).message });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message,
        performance: {
          currentBalance: 10000,
          initialBalance: 10000,
          totalPnl: 0,
          totalPnlPercentage: 0,
          maxDrawdown: 0,
          equityCurve: [{
            timestamp: Date.now(),
            balance: 10000,
            pnl: 0,
            time: new Date().toISOString()
          }],
          trades: 0,
          winRate: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          lastUpdate: Date.now()
        }
      });
    }
  });

  // 24. Close Position (POST method for compatibility)
  app.post('/close-position', {
    schema: {
      summary: 'Close a position',
      description: 'Close an open position (full or partial)',
      tags,
      body: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string', description: 'Symbol to close' },
          percentage: { type: 'number', minimum: 0, maximum: 100, description: 'Percentage to close (default: 100)' }
        }
      },
      response: {
        200: {
          description: 'Position closed successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { symbol, percentage = 100 } = request.body as { symbol: string; percentage?: number };

      // Get current position
      const positions = await binanceLiveTradingService.getPositions([symbol]);
      const position = positions.find((p: any) => p.symbol === symbol);

      if (!position || !position.contracts || position.contracts === 0) {
        await reply.status(404).send({
          success: false,
          error: 'No open position found for this symbol'
        });
        return;
      }

      // Calculate quantity to close
      const quantityToClose = Math.abs(position.contracts) * (percentage / 100);
      const closeSide = position.side === 'long' ? 'sell' : 'buy';

      // Place market order to close position
      const closeOrder = await binanceLiveTradingService.createOrder({
        symbol,
        side: closeSide,
        type: 'market',
        amount: quantityToClose,
        reduceOnly: true
      });

      tradingLogger.info('Position closed', { symbol, percentage, orderId: closeOrder.id });

      await reply.status(200).send({
        success: true,
        message: `${percentage}% of position closed successfully`,
        data: {
          symbol,
          closedPercentage: percentage,
          closedQuantity: quantityToClose,
          order: closeOrder
        }
      });

    } catch (error) {
      tradingLogger.error('Failed to close position', { error: (error as Error).message, body: request.body });
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  tradingLogger.info('Live Trading API routes registered', {
    endpoints: 24,
    component: 'api'
  });
}