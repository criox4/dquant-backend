import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  StrategyData,
  StrategyStatus,
  BacktestResult,
  StrategyTemplate,
  StrategySearchRequest,
  StrategyStats,
  StrategyPerformanceMetrics,
  StrategyRiskMetrics,
  StrategyMetadata,
  DSLStrategy
} from '@/types/strategy';
import { databaseLogger } from '@/services/logger';
import { getPrismaClient } from '@/config/database';

export class StrategyDataService {
  private get db(): PrismaClient {
    return getPrismaClient();
  }

  /**
   * Create a new strategy
   */
  async createStrategy(
    userId: string,
    name: string,
    description: string | undefined,
    symbol: string,
    timeframe: string,
    dsl: DSLStrategy,
    generatedCode?: string,
    tags: string[] = [],
    isTemplate: boolean = false
  ): Promise<StrategyData> {
    const strategyId = uuidv4();

    try {
      const metadata: StrategyMetadata = {
        createdBy: generatedCode ? 'AI' : 'USER',
        backtestCount: 0,
        liveTradeCount: 0,
        lastModifiedAt: new Date(),
        complexity: this.determineComplexity(dsl),
        marketConditions: [],
        categories: this.extractCategories(dsl, tags)
      };

      // Map DSL to schema fields
      const strategyData = {
        strategyId,
        name,
        description,
        asset: symbol,
        timeframe,
        status: 'DRAFT' as const,
        code: generatedCode,
        version: '1.0',
        indicators: JSON.stringify(dsl.indicators || []),
        parameters: JSON.stringify(dsl.params || {}),
        entryRules: JSON.stringify(dsl.entry || []),
        exitRules: JSON.stringify(dsl.exit || []),
        riskManagement: JSON.stringify(dsl.risk || {}),
        user: {
          connect: {
            userId: userId
          }
        }
      };

      const strategy = await this.db.strategy.create({
        data: strategyData
      });

      databaseLogger.info('Strategy created', {
        strategyId,
        userId,
        name,
        symbol,
        timeframe,
        hasCode: !!generatedCode,
        isTemplate
      });

      return this.mapStrategyData(strategy);

    } catch (error) {
      databaseLogger.error('Failed to create strategy', error as Error, {
        userId,
        name,
        symbol,
        timeframe
      });
      throw new Error(`Failed to create strategy: ${(error as Error).message}`);
    }
  }

  /**
   * Get strategy by ID
   */
  async getStrategy(strategyId: string): Promise<StrategyData | null> {
    try {
      const strategy = await this.db.strategy.findUnique({
        where: { strategyId },
        include: {
          backtestResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!strategy) {
        return null;
      }

      return this.mapStrategyData(strategy);

    } catch (error) {
      databaseLogger.error('Failed to get strategy', error as Error, {
        strategyId
      });
      throw new Error(`Failed to get strategy: ${(error as Error).message}`);
    }
  }

  /**
   * Update strategy
   */
  async updateStrategy(
    strategyId: string,
    updates: {
      name?: string;
      description?: string;
      status?: StrategyStatus;
      dsl?: DSLStrategy;
      generatedCode?: string;
      tags?: string[];
      performanceMetrics?: StrategyPerformanceMetrics;
      riskMetrics?: StrategyRiskMetrics;
    }
  ): Promise<StrategyData> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.generatedCode !== undefined) updateData.generatedCode = updates.generatedCode;

      if (updates.dsl) {
        updateData.dsl = JSON.stringify(updates.dsl);
        updateData.version = { increment: 1 };
      }

      // Update metadata
      if (updates.performanceMetrics || updates.riskMetrics) {
        const currentStrategy = await this.db.strategy.findUnique({
          where: { strategyId }
        });

        if (currentStrategy) {
          const metadata = JSON.parse(currentStrategy.metadata as string) as StrategyMetadata;
          metadata.lastModifiedAt = new Date();

          if (updates.performanceMetrics) {
            updateData.performanceMetrics = JSON.stringify(updates.performanceMetrics);
          }
          if (updates.riskMetrics) {
            updateData.riskMetrics = JSON.stringify(updates.riskMetrics);
          }

          updateData.metadata = JSON.stringify(metadata);
        }
      }

      const strategy = await this.db.strategy.update({
        where: { strategyId },
        data: updateData
      });

      databaseLogger.debug('Strategy updated', {
        strategyId,
        updatedFields: Object.keys(updates)
      });

      return this.mapStrategyData(strategy);

    } catch (error) {
      databaseLogger.error('Failed to update strategy', error as Error, {
        strategyId,
        updates
      });
      throw new Error(`Failed to update strategy: ${(error as Error).message}`);
    }
  }

  /**
   * Delete strategy (soft delete by archiving)
   */
  async deleteStrategy(strategyId: string): Promise<void> {
    try {
      await this.db.strategy.update({
        where: { strategyId },
        data: {
          status: 'ARCHIVED',
          updatedAt: new Date()
        }
      });

      databaseLogger.info('Strategy deleted (archived)', { strategyId });

    } catch (error) {
      databaseLogger.error('Failed to delete strategy', error as Error, {
        strategyId
      });
      throw new Error(`Failed to delete strategy: ${(error as Error).message}`);
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
      const where: any = {};

      // User filter
      if (request.userId) {
        where.userId = request.userId;
      }

      // Status filter (exclude archived by default)
      if (request.statuses && request.statuses.length > 0) {
        where.status = { in: request.statuses };
      } else {
        where.status = { not: 'ARCHIVED' };
      }

      // Symbol filter
      if (request.symbols && request.symbols.length > 0) {
        where.symbol = { in: request.symbols };
      }

      // Timeframe filter
      if (request.timeframes && request.timeframes.length > 0) {
        where.timeframe = { in: request.timeframes };
      }

      // Tags filter
      if (request.tags && request.tags.length > 0) {
        where.tags = {
          hasSome: request.tags
        };
      }

      // Text search
      if (request.query) {
        where.OR = [
          { name: { contains: request.query, mode: 'insensitive' } },
          { description: { contains: request.query, mode: 'insensitive' } }
        ];
      }

      // Performance filters would require complex JSON queries
      // For now, we'll fetch and filter in memory for performance metrics

      const orderBy: any = {};
      switch (request.sortBy) {
        case 'CREATED_AT':
          orderBy.createdAt = request.sortOrder?.toLowerCase();
          break;
        case 'NAME':
          orderBy.name = request.sortOrder?.toLowerCase();
          break;
        case 'PERFORMANCE':
        case 'TRADES':
          // These would require complex sorting, implement later
          orderBy.updatedAt = 'desc';
          break;
        default:
          orderBy.createdAt = 'desc';
      }

      // Get total count
      const total = await this.db.strategy.count({ where });

      // Get strategies
      const strategies = await this.db.strategy.findMany({
        where,
        orderBy,
        skip: request.offset,
        take: request.limit,
        include: {
          backtestResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      const mappedStrategies = strategies.map(strategy => this.mapStrategyData(strategy));

      // Apply performance filters if specified
      let filteredStrategies = mappedStrategies;
      if (request.minPerformance !== undefined || request.maxDrawdown !== undefined) {
        filteredStrategies = mappedStrategies.filter(strategy => {
          const perf = strategy.performanceMetrics;
          if (!perf) return false;

          if (request.minPerformance !== undefined && perf.totalReturn < request.minPerformance) {
            return false;
          }
          if (request.maxDrawdown !== undefined && perf.maxDrawdown > request.maxDrawdown) {
            return false;
          }

          return true;
        });
      }

      databaseLogger.debug('Strategies searched', {
        total,
        returned: filteredStrategies.length,
        filters: request
      });

      return {
        strategies: filteredStrategies,
        total,
        hasMore: (request.offset || 0) + filteredStrategies.length < total
      };

    } catch (error) {
      databaseLogger.error('Failed to search strategies', error as Error, { request });
      throw new Error(`Failed to search strategies: ${(error as Error).message}`);
    }
  }

  /**
   * Get user strategies
   */
  async getUserStrategies(userId: string, limit: number = 20): Promise<StrategyData[]> {
    try {
      const strategies = await this.db.strategy.findMany({
        where: {
          userId,
          status: { not: 'ARCHIVED' }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          backtestResults: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      return strategies.map(strategy => this.mapStrategyData(strategy));

    } catch (error) {
      databaseLogger.error('Failed to get user strategies', error as Error, { userId });
      throw new Error(`Failed to get user strategies: ${(error as Error).message}`);
    }
  }

  /**
   * Clone strategy
   */
  async cloneStrategy(
    originalStrategyId: string,
    userId: string,
    newName?: string
  ): Promise<StrategyData> {
    try {
      const original = await this.db.strategy.findUnique({
        where: { strategyId: originalStrategyId }
      });

      if (!original) {
        throw new Error('Original strategy not found');
      }

      const cloneData = {
        ...original,
        strategyId: uuidv4(),
        userId,
        name: newName || `${original.name} (Copy)`,
        status: 'DRAFT' as StrategyStatus,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        performanceMetrics: null,
        riskMetrics: null
      };

      // Update metadata
      const metadata = JSON.parse(original.metadata as string) as StrategyMetadata;
      metadata.createdBy = 'USER';
      metadata.backtestCount = 0;
      metadata.liveTradeCount = 0;
      metadata.lastModifiedAt = new Date();
      cloneData.metadata = JSON.stringify(metadata);

      delete (cloneData as any).id; // Remove auto-increment ID

      const cloned = await this.db.strategy.create({
        data: cloneData
      });

      databaseLogger.info('Strategy cloned', {
        originalId: originalStrategyId,
        clonedId: cloned.strategyId,
        userId
      });

      return this.mapStrategyData(cloned);

    } catch (error) {
      databaseLogger.error('Failed to clone strategy', error as Error, {
        originalStrategyId,
        userId
      });
      throw new Error(`Failed to clone strategy: ${(error as Error).message}`);
    }
  }

  /**
   * Get strategy statistics
   */
  async getStrategyStats(userId?: string): Promise<StrategyStats> {
    try {
      const where: any = {};
      if (userId) where.userId = userId;

      const [
        total,
        byStatus,
        byTimeframe,
        bySymbol,
        topPerforming,
        recent
      ] = await Promise.all([
        // Total count
        this.db.strategy.count({ where }),

        // By status
        this.db.strategy.groupBy({
          by: ['status'],
          where,
          _count: true
        }),

        // By timeframe
        this.db.strategy.groupBy({
          by: ['timeframe'],
          where,
          _count: true
        }),

        // By symbol
        this.db.strategy.groupBy({
          by: ['symbol'],
          where,
          _count: true
        }),

        // Top performing (simplified - would need complex JSON queries for real performance)
        this.db.strategy.findMany({
          where: { ...where, status: 'ACTIVE' },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          include: {
            backtestResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }),

        // Recent strategies
        this.db.strategy.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            backtestResults: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        })
      ]);

      // Process grouped results
      const strategiesByStatus = byStatus.reduce((acc, item) => {
        acc[item.status as StrategyStatus] = item._count;
        return acc;
      }, {} as Record<StrategyStatus, number>);

      const strategiesByTimeframe = byTimeframe.reduce((acc, item) => {
        acc[item.timeframe] = item._count;
        return acc;
      }, {} as Record<string, number>);

      const strategiesBySymbol = bySymbol.reduce((acc, item) => {
        acc[item.symbol] = item._count;
        return acc;
      }, {} as Record<string, number>);

      // Calculate averages (simplified)
      const avgPerformance = 0.05; // Would be calculated from actual performance data
      const avgDrawdown = 0.02; // Would be calculated from actual drawdown data

      return {
        totalStrategies: total,
        activeStrategies: strategiesByStatus.ACTIVE || 0,
        avgPerformance,
        avgDrawdown,
        totalBacktests: 0, // Would be calculated from backtest results
        strategiesByStatus,
        strategiesByTimeframe,
        strategiesBySymbol,
        topPerformingStrategies: topPerforming.map(s => this.mapStrategyData(s)),
        recentStrategies: recent.map(s => this.mapStrategyData(s))
      };

    } catch (error) {
      databaseLogger.error('Failed to get strategy stats', error as Error, { userId });
      throw new Error(`Failed to get strategy stats: ${(error as Error).message}`);
    }
  }

  /**
   * Update strategy performance metrics
   */
  async updateStrategyPerformance(
    strategyId: string,
    performanceMetrics: StrategyPerformanceMetrics,
    riskMetrics: StrategyRiskMetrics
  ): Promise<void> {
    try {
      await this.db.strategy.update({
        where: { strategyId },
        data: {
          performanceMetrics: JSON.stringify(performanceMetrics),
          riskMetrics: JSON.stringify(riskMetrics),
          updatedAt: new Date()
        }
      });

      // Update metadata backtest count
      const strategy = await this.db.strategy.findUnique({
        where: { strategyId }
      });

      if (strategy) {
        const metadata = JSON.parse(strategy.metadata as string) as StrategyMetadata;
        metadata.backtestCount += 1;
        metadata.lastBacktestAt = new Date();
        metadata.lastModifiedAt = new Date();

        await this.db.strategy.update({
          where: { strategyId },
          data: {
            metadata: JSON.stringify(metadata)
          }
        });
      }

      databaseLogger.debug('Strategy performance updated', {
        strategyId,
        totalReturn: performanceMetrics.totalReturn,
        sharpeRatio: performanceMetrics.sharpeRatio,
        maxDrawdown: performanceMetrics.maxDrawdown
      });

    } catch (error) {
      databaseLogger.error('Failed to update strategy performance', error as Error, {
        strategyId
      });
      throw new Error(`Failed to update strategy performance: ${(error as Error).message}`);
    }
  }

  /**
   * Map database strategy to StrategyData type
   */
  private mapStrategyData(strategy: any): StrategyData {
    const metadata = strategy.metadata ? JSON.parse(strategy.metadata) : {};
    const performanceMetrics = strategy.performanceMetrics ? JSON.parse(strategy.performanceMetrics) : undefined;
    const riskMetrics = strategy.riskMetrics ? JSON.parse(strategy.riskMetrics) : undefined;
    const dsl = strategy.dsl ? JSON.parse(strategy.dsl) : {};

    return {
      strategyId: strategy.strategyId,
      userId: strategy.userId,
      name: strategy.name,
      description: strategy.description,
      symbol: strategy.symbol,
      timeframe: strategy.timeframe,
      status: strategy.status as StrategyStatus,
      dsl,
      generatedCode: strategy.generatedCode,
      version: strategy.version,
      tags: strategy.tags || [],
      isTemplate: strategy.isTemplate || false,
      performanceMetrics,
      riskMetrics,
      metadata: {
        createdBy: metadata.createdBy || 'USER',
        aiModel: metadata.aiModel,
        backtestCount: metadata.backtestCount || 0,
        liveTradeCount: metadata.liveTradeCount || 0,
        lastBacktestAt: metadata.lastBacktestAt ? new Date(metadata.lastBacktestAt) : undefined,
        lastModifiedAt: new Date(metadata.lastModifiedAt || strategy.updatedAt),
        complexity: metadata.complexity || 'SIMPLE',
        marketConditions: metadata.marketConditions || [],
        categories: metadata.categories || []
      },
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt
    };
  }

  /**
   * Determine strategy complexity based on DSL
   */
  private determineComplexity(dsl: DSLStrategy): 'SIMPLE' | 'INTERMEDIATE' | 'ADVANCED' {
    let complexity = 0;

    complexity += dsl.indicators.length;
    complexity += dsl.entry.length;
    complexity += dsl.exit.length;

    // Check for advanced indicators
    const advancedIndicators = ['ICHIMOKU', 'MACD', 'KDJ', 'DMI'];
    if (dsl.indicators.some(ind => advancedIndicators.includes(ind.name))) {
      complexity += 2;
    }

    // Check for complex operators
    const complexOperators = ['crosses_above', 'crosses_below', 'touches', 'breaks_above', 'breaks_below'];
    if (dsl.entry.some(cond => complexOperators.includes(cond.op)) ||
        dsl.exit.some(cond => complexOperators.includes(cond.op))) {
      complexity += 1;
    }

    if (complexity <= 3) return 'SIMPLE';
    if (complexity <= 6) return 'INTERMEDIATE';
    return 'ADVANCED';
  }

  /**
   * Extract categories from DSL and tags
   */
  private extractCategories(dsl: DSLStrategy, tags: string[]): string[] {
    const categories = new Set<string>();

    // Add categories based on indicators
    if (dsl.indicators.some(ind => ['RSI', 'STOCH', 'WR', 'MFI'].includes(ind.name))) {
      categories.add('Momentum');
    }
    if (dsl.indicators.some(ind => ['SMA', 'EMA', 'VWAP'].includes(ind.name))) {
      categories.add('Trend Following');
    }
    if (dsl.indicators.some(ind => ['BB', 'ATR'].includes(ind.name))) {
      categories.add('Volatility');
    }
    if (dsl.indicators.some(ind => ['VOLUME', 'OBV'].includes(ind.name))) {
      categories.add('Volume');
    }

    // Add categories from tags
    tags.forEach(tag => {
      const lowerTag = tag.toLowerCase();
      if (['scalping', 'day trading', 'swing'].some(t => lowerTag.includes(t))) {
        categories.add('Trading Style');
      }
      if (['bullish', 'bearish', 'reversal'].some(t => lowerTag.includes(t))) {
        categories.add('Market Direction');
      }
    });

    return Array.from(categories);
  }
}

// Singleton instance
let strategyDataServiceInstance: StrategyDataService | null = null;

export function getStrategyDataService(): StrategyDataService {
  if (!strategyDataServiceInstance) {
    strategyDataServiceInstance = new StrategyDataService();
  }
  return strategyDataServiceInstance;
}

export const strategyDataService = getStrategyDataService();