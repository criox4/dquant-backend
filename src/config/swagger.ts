import { FastifyInstance } from 'fastify';
import { config } from '@/config/environment';

export async function setupSwagger(app: FastifyInstance): Promise<void> {
  // Register Swagger plugin
  await app.register(import('@fastify/swagger'), {
    swagger: {
      info: {
        title: 'DQuant Trading Backend API',
        description: 'Intelligent Trading Strategy Agent Backend Service - TypeScript Edition',
        version: '2.0.0',
        contact: {
          name: 'DQuant Team',
          email: 'support@dquant.ai'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      host: config.IS_DEVELOPMENT ? `localhost:${config.PORT}` : undefined,
      schemes: config.IS_PRODUCTION ? ['https'] : ['http'],
      consumes: ['application/json', 'multipart/form-data'],
      produces: ['application/json'],
      tags: [
        {
          name: 'Health',
          description: 'Health check and system status endpoints'
        },
        {
          name: 'Conversations',
          description: 'AI conversation and chat management'
        },
        {
          name: 'Strategies',
          description: 'Trading strategy creation and management'
        },
        {
          name: 'Backtesting',
          description: 'Historical strategy testing and validation'
        },
        {
          name: 'Paper Trading',
          description: 'Virtual trading simulation'
        },
        {
          name: 'Live Trading',
          description: 'Real money trading operations'
        },
        {
          name: 'Market Data',
          description: 'Real-time and historical market data'
        },
        {
          name: 'WebSocket',
          description: 'Real-time communication and data streaming'
        },
        {
          name: 'Authentication',
          description: 'User authentication and authorization'
        }
      ],
      definitions: {
        // Common response schemas
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'timestamp']
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [false] },
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'error', 'timestamp']
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: { type: 'array', items: { type: 'object' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' }
              },
              required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
            },
            timestamp: { type: 'string', format: 'date-time' }
          },
          required: ['success', 'data', 'pagination', 'timestamp']
        },

        // Trading specific schemas
        TradingPair: {
          type: 'string',
          pattern: '^[A-Z]+/[A-Z]+$',
          example: 'BTC/USDT'
        },
        Timeframe: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1h', '4h', '1d', '1w'],
          example: '1h'
        },
        DecimalString: {
          type: 'string',
          pattern: '^\\d+(\\.\\d+)?$',
          example: '100.50'
        },

        // Strategy schemas
        Strategy: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            strategyId: { type: 'string' },
            userId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            version: { type: 'string' },
            asset: { $ref: '#/definitions/TradingPair' },
            timeframe: { $ref: '#/definitions/Timeframe' },
            indicators: { type: 'array', items: { type: 'object' } },
            parameters: { type: 'object' },
            entryRules: { type: 'array', items: { type: 'object' } },
            exitRules: { type: 'array', items: { type: 'object' } },
            riskManagement: { type: 'object' },
            status: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'STOPPED', 'ERROR']
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },

        // Conversation schemas
        Conversation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            conversationId: { type: 'string' },
            userId: { type: 'string' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'ARCHIVED', 'DELETED']
            },
            messageCount: { type: 'number' },
            lastMessageAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },

        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            messageId: { type: 'string' },
            conversationId: { type: 'string' },
            role: {
              type: 'string',
              enum: ['USER', 'ASSISTANT', 'SYSTEM', 'TOOL']
            },
            content: { type: 'string' },
            tokenCount: { type: 'number' },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },

        // Trading schemas
        Trade: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            tradeId: { type: 'string' },
            strategyId: { type: 'string' },
            symbol: { $ref: '#/definitions/TradingPair' },
            type: {
              type: 'string',
              enum: ['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT']
            },
            side: {
              type: 'string',
              enum: ['LONG', 'SHORT']
            },
            price: { $ref: '#/definitions/DecimalString' },
            quantity: { $ref: '#/definitions/DecimalString' },
            value: { $ref: '#/definitions/DecimalString' },
            executedAt: { type: 'string', format: 'date-time' }
          }
        }
      },
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Enter: Bearer {token}'
        },
        ApiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for authentication'
        }
      }
    }
  });

  // Register Swagger UI plugin
  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        // Add custom headers or authentication if needed
        next();
      }
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, _request, _reply) => {
      // Transform the specification if needed
      return swaggerObject;
    },
    transformSpecificationClone: true
  });

  // Add custom route for OpenAPI JSON spec
  app.get('/openapi.json', {
    schema: {
      hide: true
    }
  }, async (_request, reply) => {
    await reply.send(app.swagger());
  });

  // Add custom route for OpenAPI YAML spec
  app.get('/openapi.yaml', {
    schema: {
      hide: true
    }
  }, async (_request, reply) => {
    const yaml = await import('js-yaml');
    const yamlString = yaml.dump(app.swagger());

    await reply
      .type('text/yaml')
      .send(yamlString);
  });
}