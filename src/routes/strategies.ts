import { FastifyInstance, RouteShorthandOptions } from 'fastify';
import {
  CreateStrategyRequest,
  UpdateStrategyRequest,
  StrategySearchRequest,
  DSLStrategy
} from '@/types/strategy';
import {
  createStrategyRequestSchema,
  updateStrategyRequestSchema,
  strategySearchRequestSchema
} from '@/schemas/strategy';
import { strategyManager } from '@/services/strategy-manager';
import { apiLogger } from '@/services/logger';
import { errorHandler } from '@/middleware/errorHandler';

// Request type definitions
interface CreateStrategyRequestType {
  Body: CreateStrategyRequest;
}

interface UpdateStrategyRequestType {
  Params: { id: string };
  Body: UpdateStrategyRequest;
}

interface GetStrategyRequestType {
  Params: { id: string };
}

interface SearchStrategiesRequestType {
  Querystring: StrategySearchRequest;
}

interface CloneStrategyRequestType {
  Params: { id: string };
  Body: { name?: string; userId: string };
}

interface ValidateDSLRequestType {
  Body: { dsl: DSLStrategy };
}

interface GetUserStrategiesRequestType {
  Params: { userId: string };
  Querystring: { limit?: number };
}

export default async function strategiesRoutes(fastify: FastifyInstance) {
  // Register schemas for reuse
  fastify.addSchema({
    $id: 'createStrategyRequest',
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      description: { type: 'string', maxLength: 1000 },
      symbol: { type: 'string', minLength: 1 },
      timeframe: { type: 'string', minLength: 1 },
      dsl: { $ref: 'dslStrategy' },
      naturalLanguage: { type: 'string', maxLength: 2000 },
      tags: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      isTemplate: { type: 'boolean', default: false },
      parentStrategyId: { type: 'string', format: 'uuid' }
    },
    required: ['name', 'symbol', 'timeframe']
  });

  fastify.addSchema({
    $id: 'dslStrategy',
    type: 'object',
    properties: {
      strategy_name: { type: 'string' },
      symbol: { type: 'string' },
      timeframe: { type: 'string' },
      indicators: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            alias: { type: 'string' },
            params: { type: 'object' }
          }
        }
      },
      entry: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            left: { type: 'string' },
            op: { type: 'string' },
            right: { oneOf: [{ type: 'string' }, { type: 'number' }] }
          }
        }
      },
      exit: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            left: { type: 'string' },
            op: { type: 'string' },
            right: { oneOf: [{ type: 'string' }, { type: 'number' }] }
          }
        }
      },
      risk: {
        type: 'object',
        properties: {
          stop_loss: { type: 'number' },
          take_profit: { type: 'number' },
          position_size: { type: 'number' },
          max_drawdown: { type: 'number' }
        }
      },
      params: {
        type: 'object',
        properties: {
          initial_cash: { type: 'number' },
          fee: { type: 'number' },
          slippage: { type: 'number' },
          commission: { type: 'number' }
        }
      }
    }
  });

  fastify.addSchema({
    $id: 'strategyData',
    type: 'object',
    properties: {
      strategyId: { type: 'string', format: 'uuid' },
      userId: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      description: { type: 'string' },
      symbol: { type: 'string' },
      timeframe: { type: 'string' },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'ERROR'] },
      dsl: { $ref: 'dslStrategy' },
      generatedCode: { type: 'string' },
      version: { type: 'integer' },
      tags: { type: 'array', items: { type: 'string' } },
      isTemplate: { type: 'boolean' },
      metadata: { type: 'object' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  });

  /**
   * Create a new strategy
   * POST /strategies
   */
  const createStrategyOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Create a new trading strategy',
      description: 'Create a new trading strategy from DSL or natural language description',
      tags: ['Strategies'],
      body: { $ref: 'createStrategyRequest' },
      response: {
        201: {
          description: 'Strategy created successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'strategyData' },
            message: { type: 'string' }
          }
        },
        400: {
          description: 'Invalid request data',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    }
  };

  fastify.post<CreateStrategyRequestType>('/strategies', createStrategyOpts, async (request, reply) => {
    try {
      const validatedData = createStrategyRequestSchema.parse(request.body);

      apiLogger.info('Creating new strategy via API', {
        name: validatedData.name,
        symbol: validatedData.symbol,
        timeframe: validatedData.timeframe,
        method: validatedData.dsl ? 'DSL' : 'Natural Language'
      });

      const strategy = await strategyManager.createStrategy(validatedData);

      return reply.status(201).send({
        success: true,
        data: strategy,
        message: `Strategy "${strategy.name}" created successfully`
      });

    } catch (error) {
      apiLogger.error('Failed to create strategy via API', error as Error, {
        body: request.body
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Get strategy by ID
   * GET /strategies/:id
   */
  const getStrategyOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Get strategy by ID',
      description: 'Retrieve a specific strategy by its ID',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Strategy found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'strategyData' }
          }
        },
        404: {
          description: 'Strategy not found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'object' }
          }
        }
      }
    }
  };

  fastify.get<GetStrategyRequestType>('/strategies/:id', getStrategyOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.debug('Getting strategy by ID', { strategyId: id });

      const strategy = await strategyManager.getStrategy(id);

      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: `Strategy with ID ${id} not found`
          }
        });
      }

      return reply.send({
        success: true,
        data: strategy
      });

    } catch (error) {
      apiLogger.error('Failed to get strategy', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Update strategy
   * PUT /strategies/:id
   */
  const updateStrategyOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Update strategy',
      description: 'Update an existing strategy',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'ERROR'] },
          dsl: { $ref: 'dslStrategy' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 20 }
        }
      },
      response: {
        200: {
          description: 'Strategy updated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'strategyData' },
            message: { type: 'string' }
          }
        }
      }
    }
  };

  fastify.put<UpdateStrategyRequestType>('/strategies/:id', updateStrategyOpts, async (request, reply) => {
    try {
      const { id } = request.params;
      const validatedData = updateStrategyRequestSchema.parse(request.body);

      apiLogger.info('Updating strategy via API', {
        strategyId: id,
        updates: Object.keys(validatedData)
      });

      const strategy = await strategyManager.updateStrategy(id, validatedData);

      return reply.send({
        success: true,
        data: strategy,
        message: `Strategy "${strategy.name}" updated successfully`
      });

    } catch (error) {
      apiLogger.error('Failed to update strategy via API', error as Error, {
        strategyId: request.params.id,
        body: request.body
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Delete strategy
   * DELETE /strategies/:id
   */
  const deleteStrategyOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Delete strategy',
      description: 'Delete (archive) a strategy',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Strategy deleted successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  };

  fastify.delete<GetStrategyRequestType>('/strategies/:id', deleteStrategyOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.info('Deleting strategy via API', { strategyId: id });

      await strategyManager.deleteStrategy(id);

      return reply.send({
        success: true,
        message: 'Strategy deleted successfully'
      });

    } catch (error) {
      apiLogger.error('Failed to delete strategy via API', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Search strategies
   * GET /strategies
   */
  const searchStrategiesOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Search strategies',
      description: 'Search strategies with filters and pagination',
      tags: ['Strategies'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          query: { type: 'string', maxLength: 200 },
          symbols: { type: 'array', items: { type: 'string' } },
          timeframes: { type: 'array', items: { type: 'string' } },
          statuses: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          categories: { type: 'array', items: { type: 'string' } },
          minPerformance: { type: 'number' },
          maxDrawdown: { type: 'number' },
          sortBy: { type: 'string', enum: ['PERFORMANCE', 'CREATED_AT', 'NAME', 'TRADES'] },
          sortOrder: { type: 'string', enum: ['ASC', 'DESC'] },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 }
        }
      },
      response: {
        200: {
          description: 'Strategies found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                strategies: { type: 'array', items: { $ref: 'strategyData' } },
                total: { type: 'integer' },
                hasMore: { type: 'boolean' },
                pagination: {
                  type: 'object',
                  properties: {
                    limit: { type: 'integer' },
                    offset: { type: 'integer' },
                    total: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  fastify.get<SearchStrategiesRequestType>('/strategies', searchStrategiesOpts, async (request, reply) => {
    try {
      const validatedQuery = strategySearchRequestSchema.parse(request.query);

      apiLogger.debug('Searching strategies via API', { filters: validatedQuery });

      const result = await strategyManager.searchStrategies(validatedQuery);

      return reply.send({
        success: true,
        data: {
          ...result,
          pagination: {
            limit: validatedQuery.limit || 20,
            offset: validatedQuery.offset || 0,
            total: result.total
          }
        }
      });

    } catch (error) {
      apiLogger.error('Failed to search strategies via API', error as Error, {
        query: request.query
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Clone strategy
   * POST /strategies/:id/clone
   */
  const cloneStrategyOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Clone strategy',
      description: 'Create a copy of an existing strategy',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 200 },
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      },
      response: {
        201: {
          description: 'Strategy cloned successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'strategyData' },
            message: { type: 'string' }
          }
        }
      }
    }
  };

  fastify.post<CloneStrategyRequestType>('/strategies/:id/clone', cloneStrategyOpts, async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, userId } = request.body;

      apiLogger.info('Cloning strategy via API', {
        originalId: id,
        userId,
        newName: name
      });

      const clonedStrategy = await strategyManager.cloneStrategy(id, userId, name);

      return reply.status(201).send({
        success: true,
        data: clonedStrategy,
        message: `Strategy cloned successfully as "${clonedStrategy.name}"`
      });

    } catch (error) {
      apiLogger.error('Failed to clone strategy via API', error as Error, {
        originalId: request.params.id,
        body: request.body
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Validate DSL
   * POST /strategies/validate-dsl
   */
  const validateDSLOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Validate DSL strategy',
      description: 'Validate a DSL strategy structure and provide feedback',
      tags: ['Strategies'],
      body: {
        type: 'object',
        properties: {
          dsl: { $ref: 'dslStrategy' }
        },
        required: ['dsl']
      },
      response: {
        200: {
          description: 'DSL validation result',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isValid: { type: 'boolean' },
                errors: { type: 'array' },
                warnings: { type: 'array' },
                suggestions: { type: 'array' },
                estimatedComplexity: { type: 'string' },
                estimatedPerformance: { type: 'string' }
              }
            }
          }
        }
      }
    }
  };

  fastify.post<ValidateDSLRequestType>('/strategies/validate-dsl', validateDSLOpts, async (request, reply) => {
    try {
      const { dsl } = request.body;

      apiLogger.debug('Validating DSL via API', {
        strategyName: dsl.strategy_name,
        indicatorCount: dsl.indicators.length
      });

      const validation = await strategyManager.validateStrategy(dsl);

      return reply.send({
        success: true,
        data: validation
      });

    } catch (error) {
      apiLogger.error('Failed to validate DSL via API', error as Error, {
        body: request.body
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Get user strategies
   * GET /users/:userId/strategies
   */
  const getUserStrategiesOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Get user strategies',
      description: 'Get all strategies for a specific user',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          description: 'User strategies',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { $ref: 'strategyData' }
            }
          }
        }
      }
    }
  };

  fastify.get<GetUserStrategiesRequestType>('/users/:userId/strategies', getUserStrategiesOpts, async (request, reply) => {
    try {
      const { userId } = request.params;
      const { limit = 20 } = request.query;

      apiLogger.debug('Getting user strategies via API', { userId, limit });

      const strategies = await strategyManager.strategyDataService.getUserStrategies(userId, limit);

      return reply.send({
        success: true,
        data: strategies
      });

    } catch (error) {
      apiLogger.error('Failed to get user strategies via API', error as Error, {
        userId: request.params.userId
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Get strategy statistics
   * GET /strategies/stats
   */
  const getStatsOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Get strategy statistics',
      description: 'Get comprehensive statistics about strategies',
      tags: ['Strategies'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          description: 'Strategy statistics',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalStrategies: { type: 'integer' },
                activeStrategies: { type: 'integer' },
                avgPerformance: { type: 'number' },
                avgDrawdown: { type: 'number' },
                totalBacktests: { type: 'integer' },
                strategiesByStatus: { type: 'object' },
                strategiesByTimeframe: { type: 'object' },
                strategiesBySymbol: { type: 'object' },
                topPerformingStrategies: { type: 'array' },
                recentStrategies: { type: 'array' }
              }
            }
          }
        }
      }
    }
  };

  fastify.get('/strategies/stats', getStatsOpts, async (request, reply) => {
    try {
      const { userId } = request.query as { userId?: string };

      apiLogger.debug('Getting strategy stats via API', { userId });

      const stats = await strategyManager.getStrategyStats(userId);

      return reply.send({
        success: true,
        data: stats
      });

    } catch (error) {
      apiLogger.error('Failed to get strategy stats via API', error as Error, {
        userId: (request.query as any)?.userId
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Generate strategy code
   * POST /strategies/:id/generate-code
   */
  const generateCodeOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Generate strategy code',
      description: 'Generate executable trading code from strategy DSL',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Strategy code generated',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                metadata: {
                  type: 'object',
                  properties: {
                    generatedAt: { type: 'string' },
                    codeLength: { type: 'integer' },
                    complexity: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  fastify.post<GetStrategyRequestType>('/strategies/:id/generate-code', generateCodeOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.info('Generating strategy code via API', { strategyId: id });

      const strategy = await strategyManager.getStrategy(id);
      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: `Strategy with ID ${id} not found`
          }
        });
      }

      const code = await strategyManager.dslProcessor.generateTradingCode(strategy.dsl);

      // Update strategy with generated code (stored in strategy metadata)
      // Note: metadata is not in UpdateStrategyRequest type, so we skip storing it
      // The code is already generated and returned in the response

      return reply.send({
        success: true,
        data: {
          code,
          metadata: {
            generatedAt: new Date().toISOString(),
            codeLength: code.length,
            complexity: strategy.metadata.complexity
          }
        }
      });

    } catch (error) {
      apiLogger.error('Failed to generate strategy code via API', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Export strategy code as downloadable file
   * POST /strategies/:id/export/code
   */
  const exportCodeOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Export strategy code as file',
      description: 'Export strategy as downloadable JavaScript file',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      },
      response: {
        200: {
          description: 'Strategy code file',
          type: 'string'
        }
      }
    }
  };

  fastify.post<GetStrategyRequestType>('/strategies/:id/export/code', exportCodeOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.info('Exporting strategy code as file via API', { strategyId: id });

      const strategy = await strategyManager.getStrategy(id);
      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: `Strategy with ID ${id} not found`
          }
        });
      }

      // Generate code if not already generated
      let code = strategy.generatedCode || (strategy.metadata as any)?.generatedCode;
      if (!code) {
        code = await strategyManager.dslProcessor.generateTradingCode(strategy.dsl);
        // Code is generated on-demand, not stored in DB
      }

      // Create filename
      const filename = `${strategy.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_strategy.js`;

      // Set headers for file download
      reply.header('Content-Type', 'application/javascript');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(code);

    } catch (error) {
      apiLogger.error('Failed to export strategy code via API', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Export strategy as JSON
   * POST /strategies/:id/export/json
   */
  const exportJsonOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Export strategy as JSON',
      description: 'Export complete strategy data as JSON file',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  };

  fastify.post<GetStrategyRequestType>('/strategies/:id/export/json', exportJsonOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.info('Exporting strategy as JSON via API', { strategyId: id });

      const strategy = await strategyManager.getStrategy(id);
      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: `Strategy with ID ${id} not found`
          }
        });
      }

      // Create exportable strategy data
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        strategy: {
          name: strategy.name,
          description: strategy.description,
          symbol: strategy.symbol,
          timeframe: strategy.timeframe,
          dsl: strategy.dsl,
          tags: strategy.tags,
          metadata: strategy.metadata
        }
      };

      // Create filename
      const filename = `${strategy.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_strategy.json`;

      // Set headers for file download
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return reply.send(exportData);

    } catch (error) {
      apiLogger.error('Failed to export strategy as JSON via API', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });

  /**
   * Get strategy export data (without download)
   * GET /strategies/:id/export/data
   */
  const getExportDataOpts: RouteShorthandOptions = {
    schema: {
      summary: 'Get strategy export data',
      description: 'Get strategy data for export without downloading file',
      tags: ['Strategies'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        },
        required: ['id']
      }
    }
  };

  fastify.get<GetStrategyRequestType>('/strategies/:id/export/data', getExportDataOpts, async (request, reply) => {
    try {
      const { id } = request.params;

      apiLogger.debug('Getting strategy export data via API', { strategyId: id });

      const strategy = await strategyManager.getStrategy(id);
      if (!strategy) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'STRATEGY_NOT_FOUND',
            message: `Strategy with ID ${id} not found`
          }
        });
      }

      // Create exportable strategy data
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        strategy: {
          name: strategy.name,
          description: strategy.description,
          symbol: strategy.symbol,
          timeframe: strategy.timeframe,
          dsl: strategy.dsl,
          generatedCode: strategy.generatedCode,
          tags: strategy.tags,
          metadata: strategy.metadata
        }
      };

      return reply.send({
        success: true,
        data: exportData
      });

    } catch (error) {
      apiLogger.error('Failed to get strategy export data via API', error as Error, {
        strategyId: request.params.id
      });

      return errorHandler(error as Error, request, reply);
    }
  });
}