import {
  StrategyData,
  StrategyStatus,
  DSLStrategy,
  StrategyManagerConfig,
  CreateStrategyRequest,
  UpdateStrategyRequest,
  StrategySearchRequest,
  StrategyStats,
  ProcessMessageResponse,
  StrategyOptimizationRequest,
  StrategyOptimizationResult,
  BacktestResult,
  DSLValidationResult
} from '@/types/strategy';
import { StrategyDataService, getStrategyDataService } from '@/services/strategy-data';
import { DSLProcessor, getDSLProcessor } from '@/services/dsl-processor';
import { broadcastToRoom } from '@/websocket/server';
import { apiLogger, performanceLogger } from '@/services/logger';
import { WebSocketEvent } from '@/types/common';

export class StrategyManager {
  private activeStrategies = new Map<string, StrategyData>();
  private config: StrategyManagerConfig;
  private stats = {
    strategiesCreated: 0,
    strategiesOptimized: 0,
    backtestsRun: 0,
    totalProcessingTime: 0
  };

  public strategyDataService: StrategyDataService;
  public dslProcessor: DSLProcessor;

  constructor(
    strategyDataService?: StrategyDataService,
    dslProcessor?: DSLProcessor,
    config: Partial<StrategyManagerConfig> = {}
  ) {
    this.strategyDataService = strategyDataService || getStrategyDataService();
    this.dslProcessor = dslProcessor || getDSLProcessor();

    this.config = {
      maxActiveStrategies: 100,
      defaultInitialCapital: 10000,
      maxBacktestDuration: 60, // minutes
      enableOptimization: true,
      enableLiveTrading: false,
      riskLimits: {
        maxDrawdown: 0.2,
        maxDailyLoss: 0.05,
        maxPositionSize: 0.1
      },
      ...config
    };
  }

  /**
   * Create a new strategy from user request
   */
  async createStrategy(request: CreateStrategyRequest): Promise<StrategyData> {
    const timer = performanceLogger.startTimer(`createStrategy:${request.name}`);

    try {
      apiLogger.info('Creating new strategy', {
        name: request.name,
        symbol: request.symbol,
        timeframe: request.timeframe,
        hasDSL: !!request.dsl,
        hasNaturalLanguage: !!request.naturalLanguage
      });

      let dsl: DSLStrategy;
      let generatedCode: string | undefined;

      if (request.dsl) {
        // Use provided DSL
        dsl = request.dsl;

        // Validate DSL
        const validation = await this.dslProcessor.validateDSL(dsl);
        if (!validation.isValid) {
          throw new Error(`Invalid DSL: ${validation.errors[0]?.message}`);
        }

      } else if (request.naturalLanguage) {
        // Parse natural language to DSL
        dsl = await this.dslProcessor.parseNaturalLanguage(
          request.naturalLanguage,
          request.symbol,
          request.timeframe
        );
      } else {
        throw new Error('Either DSL or natural language description must be provided');
      }

      // Generate trading code
      generatedCode = await this.dslProcessor.generateTradingCode(dsl);

      // Handle cloning if parent strategy provided
      if (request.parentStrategyId) {
        const parentStrategy = await this.strategyDataService.getStrategy(request.parentStrategyId);
        if (parentStrategy) {
          // Merge parent DSL with new modifications
          dsl = this.mergeDSLStrategies(parentStrategy.dsl, dsl);
        }
      }

      // Create strategy in database
      const strategy = await this.strategyDataService.createStrategy(
        'default_user', // TODO: Get from request context
        request.name,
        request.description,
        request.symbol,
        request.timeframe,
        dsl,
        generatedCode,
        request.tags,
        request.isTemplate
      );

      // Cache strategy for quick access
      this.activeStrategies.set(strategy.strategyId, strategy);

      // Update stats
      this.stats.strategiesCreated++;
      this.stats.totalProcessingTime += Date.now() - timer.startTime;

      // Send WebSocket notification
      await this.notifyStrategyEvent('strategy_created', strategy.strategyId, {
        strategy: strategy,
        processingTime: Date.now() - timer.startTime
      });

      performanceLogger.endTimer(timer);

      apiLogger.info('Strategy created successfully', {
        strategyId: strategy.strategyId,
        name: strategy.name,
        complexity: strategy.metadata.complexity,
        indicatorCount: dsl.indicators.length
      });

      return strategy;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to create strategy', error as Error, {
        name: request.name,
        symbol: request.symbol,
        timeframe: request.timeframe
      });
      throw error;
    }
  }

  /**
   * Update an existing strategy
   */
  async updateStrategy(strategyId: string, request: UpdateStrategyRequest): Promise<StrategyData> {
    const timer = performanceLogger.startTimer(`updateStrategy:${strategyId}`);

    try {
      apiLogger.info('Updating strategy', {
        strategyId,
        updates: Object.keys(request)
      });

      let generatedCode: string | undefined;

      // If DSL is updated, regenerate code
      if (request.dsl) {
        const validation = await this.dslProcessor.validateDSL(request.dsl);
        if (!validation.isValid) {
          throw new Error(`Invalid DSL: ${validation.errors[0]?.message}`);
        }

        generatedCode = await this.dslProcessor.generateTradingCode(request.dsl);
      }

      const strategy = await this.strategyDataService.updateStrategy(strategyId, {
        ...request,
        generatedCode
      });

      // Update cache
      this.activeStrategies.set(strategyId, strategy);

      // Send WebSocket notification
      await this.notifyStrategyEvent('strategy_updated', strategyId, {
        strategy: strategy,
        updatedFields: Object.keys(request)
      });

      performanceLogger.endTimer(timer);

      apiLogger.info('Strategy updated successfully', {
        strategyId,
        updatedFields: Object.keys(request)
      });

      return strategy;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to update strategy', error as Error, {
        strategyId,
        updates: request
      });
      throw error;
    }
  }

  /**
   * Delete a strategy
   */
  async deleteStrategy(strategyId: string): Promise<void> {
    try {
      await this.strategyDataService.deleteStrategy(strategyId);

      // Remove from cache
      this.activeStrategies.delete(strategyId);

      // Send WebSocket notification
      await this.notifyStrategyEvent('strategy_deleted', strategyId, {
        strategyId
      });

      apiLogger.info('Strategy deleted successfully', { strategyId });

    } catch (error) {
      apiLogger.error('Failed to delete strategy', error as Error, { strategyId });
      throw error;
    }
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyData | null> {
    try {
      // Check cache first
      let strategy = this.activeStrategies.get(strategyId);

      if (!strategy) {
        // Fetch from database
        strategy = await this.strategyDataService.getStrategy(strategyId);
        if (strategy) {
          this.activeStrategies.set(strategyId, strategy);
        }
      }

      return strategy || null;

    } catch (error) {
      apiLogger.error('Failed to get strategy', error as Error, { strategyId });
      throw error;
    }
  }

  /**
   * Search strategies with filters
   */
  async searchStrategies(request: StrategySearchRequest): Promise<{
    strategies: StrategyData[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      return await this.strategyDataService.searchStrategies(request);
    } catch (error) {
      apiLogger.error('Failed to search strategies', error as Error, { request });
      throw error;
    }
  }

  /**
   * Clone a strategy
   */
  async cloneStrategy(originalStrategyId: string, userId: string, newName?: string): Promise<StrategyData> {
    const timer = performanceLogger.startTimer(`cloneStrategy:${originalStrategyId}`);

    try {
      apiLogger.info('Cloning strategy', {
        originalStrategyId,
        userId,
        newName
      });

      const cloned = await this.strategyDataService.cloneStrategy(
        originalStrategyId,
        userId,
        newName
      );

      // Cache the cloned strategy
      this.activeStrategies.set(cloned.strategyId, cloned);

      // Send WebSocket notification
      await this.notifyStrategyEvent('strategy_created', cloned.strategyId, {
        strategy: cloned,
        clonedFrom: originalStrategyId
      });

      performanceLogger.endTimer(timer);

      apiLogger.info('Strategy cloned successfully', {
        originalId: originalStrategyId,
        clonedId: cloned.strategyId
      });

      return cloned;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to clone strategy', error as Error, {
        originalStrategyId,
        userId
      });
      throw error;
    }
  }

  /**
   * Validate DSL strategy
   */
  async validateStrategy(dsl: DSLStrategy): Promise<DSLValidationResult> {
    try {
      return await this.dslProcessor.validateDSL(dsl);
    } catch (error) {
      apiLogger.error('Failed to validate strategy DSL', error as Error, {
        strategyName: dsl.strategy_name
      });
      throw error;
    }
  }

  /**
   * Process strategy request from conversation
   */
  async processStrategyMessage(
    conversationId: string,
    message: string,
    context: any = {}
  ): Promise<ProcessMessageResponse> {
    const timer = performanceLogger.startTimer(`processStrategyMessage:${conversationId}`);

    try {
      apiLogger.info('Processing strategy message', {
        conversationId,
        messageLength: message.length,
        hasContext: !!context && Object.keys(context).length > 0
      });

      // Determine message intent
      const intent = await this.analyzeStrategyIntent(message, context);

      let response: ProcessMessageResponse;

      switch (intent.type) {
        case 'CREATE_STRATEGY':
          response = await this.handleCreateStrategyMessage(message, intent.parameters);
          break;

        case 'MODIFY_STRATEGY':
          response = await this.handleModifyStrategyMessage(message, intent.parameters, context);
          break;

        case 'OPTIMIZE_STRATEGY':
          response = await this.handleOptimizeStrategyMessage(message, intent.parameters, context);
          break;

        case 'BACKTEST_STRATEGY':
          response = await this.handleBacktestStrategyMessage(message, intent.parameters, context);
          break;

        case 'ANALYZE_STRATEGY':
          response = await this.handleAnalyzeStrategyMessage(message, intent.parameters, context);
          break;

        default:
          response = await this.handleGeneralStrategyQuery(message, context);
      }

      performanceLogger.endTimer(timer);

      apiLogger.info('Strategy message processed', {
        conversationId,
        action: response.action,
        hasStrategyId: !!response.strategyId
      });

      return response;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Failed to process strategy message', error as Error, {
        conversationId,
        messageLength: message.length
      });

      return {
        message: `I encountered an error while processing your strategy request: ${(error as Error).message}. Please try rephrasing your request or provide more specific details.`,
        action: 'GENERAL_RESPONSE',
        metadata: {
          error: (error as Error).message,
          processingTime: Date.now() - timer.startTime
        }
      };
    }
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(userId?: string): Promise<StrategyStats> {
    try {
      const dbStats = await this.strategyDataService.getStrategyStats(userId);

      // Merge with manager stats
      return {
        ...dbStats,
        totalBacktests: this.stats.backtestsRun
      };

    } catch (error) {
      apiLogger.error('Failed to get strategy stats', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get manager statistics
   */
  getManagerStats() {
    return {
      ...this.stats,
      activeStrategiesInMemory: this.activeStrategies.size,
      averageProcessingTime: this.stats.strategiesCreated > 0
        ? this.stats.totalProcessingTime / this.stats.strategiesCreated
        : 0
    };
  }

  // Private helper methods

  private async analyzeStrategyIntent(message: string, context: any) {
    const lowerMessage = message.toLowerCase();

    // Strategy creation patterns
    if (lowerMessage.includes('create') || lowerMessage.includes('build') || lowerMessage.includes('make')) {
      if (lowerMessage.includes('strategy') || lowerMessage.includes('algorithm') || lowerMessage.includes('trading')) {
        return {
          type: 'CREATE_STRATEGY',
          parameters: { message, context }
        };
      }
    }

    // Strategy modification patterns
    if (lowerMessage.includes('modify') || lowerMessage.includes('change') || lowerMessage.includes('update')) {
      if (context.currentStrategy) {
        return {
          type: 'MODIFY_STRATEGY',
          parameters: { message, strategyId: context.currentStrategy.strategyId }
        };
      }
    }

    // Optimization patterns
    if (lowerMessage.includes('optimize') || lowerMessage.includes('improve') || lowerMessage.includes('tune')) {
      return {
        type: 'OPTIMIZE_STRATEGY',
        parameters: { message, context }
      };
    }

    // Backtest patterns
    if (lowerMessage.includes('backtest') || lowerMessage.includes('test') || lowerMessage.includes('performance')) {
      return {
        type: 'BACKTEST_STRATEGY',
        parameters: { message, context }
      };
    }

    // Analysis patterns
    if (lowerMessage.includes('analyze') || lowerMessage.includes('explain') || lowerMessage.includes('how')) {
      return {
        type: 'ANALYZE_STRATEGY',
        parameters: { message, context }
      };
    }

    return {
      type: 'GENERAL_QUERY',
      parameters: { message, context }
    };
  }

  private async handleCreateStrategyMessage(
    message: string,
    parameters: any
  ): Promise<ProcessMessageResponse> {
    try {
      // Extract strategy parameters from message
      const symbol = this.extractSymbol(message) || 'BTC/USDT';
      const timeframe = this.extractTimeframe(message) || '1h';
      const name = this.extractStrategyName(message) || `Strategy_${Date.now()}`;

      // Create strategy from natural language
      const request: CreateStrategyRequest = {
        name,
        description: `Strategy created from: "${message}"`,
        symbol,
        timeframe,
        naturalLanguage: message,
        tags: ['AI-generated', 'conversation']
      };

      const strategy = await this.createStrategy(request);

      return {
        message: `I've created a new trading strategy called "${strategy.name}" for ${strategy.symbol} on ${strategy.timeframe} timeframe. The strategy uses ${strategy.dsl.indicators.length} technical indicators and has been generated based on your requirements. Would you like me to run a backtest or explain how it works?`,
        strategyId: strategy.strategyId,
        action: 'STRATEGY_CREATED',
        data: {
          strategy,
          dsl: strategy.dsl,
          complexity: strategy.metadata.complexity
        },
        metadata: {
          aiModel: 'DSL-Processor',
          processingTime: parameters.processingTime
        }
      };

    } catch (error) {
      return {
        message: `I couldn't create the strategy due to an error: ${(error as Error).message}. Please provide more specific details about the indicators, entry/exit conditions, and risk management you'd like to use.`,
        action: 'GENERAL_RESPONSE',
        metadata: {
          error: (error as Error).message
        }
      };
    }
  }

  private async handleModifyStrategyMessage(
    message: string,
    parameters: any,
    context: any
  ): Promise<ProcessMessageResponse> {
    // Implementation for strategy modification
    return {
      message: "Strategy modification functionality is being implemented. Please specify what changes you'd like to make to your strategy.",
      action: 'GENERAL_RESPONSE'
    };
  }

  private async handleOptimizeStrategyMessage(
    message: string,
    parameters: any,
    context: any
  ): Promise<ProcessMessageResponse> {
    // Implementation for strategy optimization
    return {
      message: "Strategy optimization functionality is being implemented. I'll help you find the best parameters for your strategy.",
      action: 'GENERAL_RESPONSE'
    };
  }

  private async handleBacktestStrategyMessage(
    message: string,
    parameters: any,
    context: any
  ): Promise<ProcessMessageResponse> {
    // Implementation for backtesting
    return {
      message: "Backtesting functionality is being implemented. I'll help you test your strategy on historical data.",
      action: 'GENERAL_RESPONSE'
    };
  }

  private async handleAnalyzeStrategyMessage(
    message: string,
    parameters: any,
    context: any
  ): Promise<ProcessMessageResponse> {
    // Implementation for strategy analysis
    return {
      message: "Strategy analysis functionality is being implemented. I'll provide detailed insights about your strategy's logic and performance potential.",
      action: 'GENERAL_RESPONSE'
    };
  }

  private async handleGeneralStrategyQuery(message: string, context: any): Promise<ProcessMessageResponse> {
    const responses = [
      "I can help you create, modify, optimize, and backtest trading strategies. What would you like to do?",
      "I'm here to assist with your trading strategy development. Would you like to create a new strategy or work with an existing one?",
      "Let me help you with trading strategies. I can build custom strategies based on technical indicators, risk management rules, and your trading preferences."
    ];

    return {
      message: responses[Math.floor(Math.random() * responses.length)],
      action: 'GENERAL_RESPONSE',
      metadata: {
        availableActions: ['CREATE_STRATEGY', 'MODIFY_STRATEGY', 'BACKTEST_STRATEGY', 'OPTIMIZE_STRATEGY']
      }
    };
  }

  private extractSymbol(message: string): string | null {
    const symbolPattern = /([A-Z]{3,4})[\/\-]?(USDT|USD|BTC|ETH)/gi;
    const match = message.match(symbolPattern);
    return match ? match[0].replace(/[\/\-]/g, '/').toUpperCase() : null;
  }

  private extractTimeframe(message: string): string | null {
    const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
    const lowerMessage = message.toLowerCase();

    for (const tf of timeframes) {
      if (lowerMessage.includes(tf) || lowerMessage.includes(tf.replace(/[hmd]/, ' ' + tf.slice(-1)))) {
        return tf;
      }
    }

    return null;
  }

  private extractStrategyName(message: string): string | null {
    const patterns = [
      /(?:call|name|called)\s+(?:it\s+)?["']([^"']+)["']/i,
      /["']([^"']+)["']\s+strategy/i,
      /strategy\s+["']([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private mergeDSLStrategies(parent: DSLStrategy, child: DSLStrategy): DSLStrategy {
    // Simple merge logic - in practice this would be more sophisticated
    return {
      ...parent,
      ...child,
      indicators: [...parent.indicators, ...child.indicators],
      entry: [...parent.entry, ...child.entry],
      exit: [...parent.exit, ...child.exit]
    };
  }

  private async notifyStrategyEvent(
    event: string,
    strategyId: string,
    data: any
  ): Promise<void> {
    const wsEvent: WebSocketEvent = {
      event: event as any,
      data: {
        strategyId,
        ...data
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to strategy-specific room
    await broadcastToRoom(`strategy_${strategyId}`, wsEvent);

    // Broadcast to general strategies room
    await broadcastToRoom('strategies', wsEvent);
  }
}

// Singleton instance
export const strategyManager = new StrategyManager();