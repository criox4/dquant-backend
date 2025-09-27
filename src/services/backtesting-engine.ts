/**
 * Backtesting Engine - Historical Strategy Testing and Analysis
 * Comprehensive backtesting system with performance metrics and risk analysis
 */

import { EventEmitter } from 'events';
import {
  BacktestRequest,
  BacktestConfiguration,
  BacktestResult,
  BacktestCandle,
  BacktestTrade,
  BacktestPosition,
  BacktestSignal,
  BacktestContext,
  BacktestPerformanceMetrics,
  BacktestRiskMetrics,
  BacktestEquityCurve,
  BacktestMonthlyReturns,
  BacktestProgress,
  BacktestStrategy,
  BacktestEngine,
  BacktestEvent,
  BacktestStatistics,
  BacktestOptimization,
  BacktestOptimizationResult,
  BacktestComparison
} from '@/types/backtest';
import { marketDataService } from '@/services/market-data';
import { strategyDataService } from '@/services/strategy-data';
import { strategyExecutionEngine } from '@/services/strategy-execution-engine';
import { StrategyDSL } from '@/types/strategy-execution';
import { apiLogger, performanceLogger } from '@/services/logger';
import { v4 as uuidv4 } from 'uuid';

export class BacktestingEngine extends EventEmitter implements BacktestEngine {
  private runningBacktests = new Map<string, BacktestProgress>();
  private completedBacktests = new Map<string, BacktestResult>();
  private strategies = new Map<string, BacktestStrategy>();
  private stats: BacktestStatistics;

  constructor() {
    super();
    this.stats = {
      totalBacktests: 0,
      runningBacktests: 0,
      completedBacktests: 0,
      failedBacktests: 0,
      averageExecutionTime: 0,
      averagePerformance: this.getDefaultPerformanceMetrics(),
      topPerformers: []
    };
  }

  /**
   * Run backtest using DSL strategy
   */
  async runBacktestWithDSL(dsl: StrategyDSL, startDate: Date, endDate: Date): Promise<BacktestResult> {
    const backtestId = uuidv4();
    const timer = performanceLogger.startTimer(`dsl-backtest:${backtestId}`);

    try {
      apiLogger.info('Starting DSL backtest', {
        backtestId,
        strategy: dsl.strategy_name,
        symbol: dsl.symbol,
        timeframe: dsl.timeframe
      });

      // Get historical data
      const historicalData = await this.getHistoricalDataForDSL(dsl, startDate, endDate);

      // Execute strategy using Strategy Execution Engine
      const executionResult = await strategyExecutionEngine.executeFromDSL(dsl, historicalData);

      // Convert to BacktestResult format
      const result = this.convertExecutionResultToBacktestResult(backtestId, executionResult, dsl);

      performanceLogger.endTimer(timer);

      apiLogger.info('DSL backtest completed', {
        backtestId,
        totalTrades: result.performance.totalTrades,
        winRate: result.performance.winRate,
        totalReturn: result.performance.totalReturn
      });

      return result;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('DSL backtest failed', error as Error);
      throw error;
    }
  }

  /**
   * Run a comprehensive backtest
   */
  async runBacktest(config: BacktestConfiguration): Promise<BacktestResult> {
    const backtestId = uuidv4();
    const timer = performanceLogger.startTimer(`backtest:${backtestId}`);

    try {
      apiLogger.info('Starting backtest', {
        backtestId,
        strategyId: config.strategyId,
        symbol: config.symbol,
        timeframe: config.timeframe,
        period: `${config.startDate} to ${config.endDate}`
      });

      // Initialize backtest result
      const result: BacktestResult = {
        id: uuidv4(),
        backtestId,
        strategyId: config.strategyId,
        symbol: config.symbol,
        timeframe: config.timeframe,
        status: 'RUNNING',
        startTime: new Date(),
        configuration: config,
        performance: this.getDefaultPerformanceMetrics(),
        riskMetrics: this.getDefaultRiskMetrics(),
        equityCurve: [],
        monthlyReturns: [],
        positions: [],
        trades: [],
        metadata: {
          candlesProcessed: 0,
          signalsGenerated: 0,
          executionTime: 0,
          memoryUsage: 0,
          version: '1.0.0'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Update stats
      this.stats.totalBacktests++;
      this.stats.runningBacktests++;

      // Initialize progress tracking
      const progress: BacktestProgress = {
        backtestId,
        percentage: 0,
        currentCandle: 0,
        totalCandles: 0,
        currentDate: new Date(config.startDate),
        status: 'Initializing',
        recentTrades: [],
        currentEquity: config.initialCapital,
        currentDrawdown: 0
      };

      this.runningBacktests.set(backtestId, progress);

      // Emit started event
      this.emit('started', {
        type: 'STARTED',
        backtestId,
        data: { configuration: config, estimatedDuration: 0 },
        timestamp: Date.now()
      } as BacktestEvent);

      // Fetch historical data
      progress.status = 'Fetching historical data';
      this.updateProgress(progress);

      const historicalData = await this.fetchHistoricalData(config);
      if (!historicalData || historicalData.length === 0) {
        throw new Error('No historical data available for the specified period');
      }

      progress.totalCandles = historicalData.length;
      progress.status = 'Loading strategy';
      this.updateProgress(progress);

      // Load strategy
      const strategy = await this.loadStrategy(config.strategyId);
      if (!strategy) {
        throw new Error(`Strategy not found: ${config.strategyId}`);
      }

      // Initialize strategy
      if (strategy.initialize) {
        await strategy.initialize();
      }

      // Execute backtesting
      result.performance = await this.executeBacktest(
        strategy,
        historicalData,
        config,
        progress,
        result
      );

      // Calculate risk metrics
      result.riskMetrics = this.calculateRiskMetrics(result);

      // Generate equity curve and monthly returns
      result.equityCurve = this.generateEquityCurve(result);
      result.monthlyReturns = this.generateMonthlyReturns(result);

      // Finalize result
      result.status = 'COMPLETED';
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      result.metadata.executionTime = result.duration;
      result.metadata.memoryUsage = process.memoryUsage().heapUsed;
      result.updatedAt = new Date();

      // Update stats
      this.stats.runningBacktests--;
      this.stats.completedBacktests++;
      this.updateAverageExecutionTime(result.duration);
      this.updateTopPerformers(result);

      // Store result
      this.completedBacktests.set(backtestId, result);
      this.runningBacktests.delete(backtestId);

      performanceLogger.endTimer(timer);

      // Emit completed event
      this.emit('completed', {
        type: 'COMPLETED',
        backtestId,
        data: result,
        timestamp: Date.now()
      } as BacktestEvent);

      apiLogger.info('Backtest completed', {
        backtestId,
        duration: result.duration,
        totalReturn: result.performance.totalReturnPercentage,
        maxDrawdown: result.performance.maxDrawdownPercentage,
        sharpeRatio: result.performance.sharpeRatio,
        totalTrades: result.performance.totalTrades
      });

      return result;

    } catch (error) {
      this.stats.runningBacktests--;
      this.stats.failedBacktests++;

      performanceLogger.endTimer(timer);

      const errorResult: BacktestResult = {
        ...this.getDefaultBacktestResult(),
        backtestId,
        strategyId: config.strategyId,
        symbol: config.symbol,
        timeframe: config.timeframe,
        status: 'FAILED',
        startTime: new Date(),
        endTime: new Date(),
        configuration: config,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.runningBacktests.delete(backtestId);

      // Emit error event
      this.emit('error', {
        type: 'ERROR',
        backtestId,
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: Date.now()
      } as BacktestEvent);

      apiLogger.error('Backtest failed', error as Error, { backtestId });

      throw error;
    }
  }

  /**
   * Execute the main backtesting logic
   */
  private async executeBacktest(
    strategy: BacktestStrategy,
    historicalData: BacktestCandle[],
    config: BacktestConfiguration,
    progress: BacktestProgress,
    result: BacktestResult
  ): Promise<BacktestPerformanceMetrics> {
    progress.status = 'Running backtest';

    // Initialize context
    const context: BacktestContext = {
      equity: config.initialCapital,
      availableCash: config.initialCapital,
      positions: [],
      openPositions: [],
      trades: [],
      currentCandle: historicalData[0],
      previousCandles: [],
      indicators: {},
      configuration: config,
      progress: {
        candleIndex: 0,
        totalCandles: historicalData.length,
        currentDate: new Date(historicalData[0].timestamp)
      }
    };

    // Process each candle
    for (let i = 0; i < historicalData.length; i++) {
      const candle = historicalData[i];
      context.currentCandle = candle;
      context.progress.candleIndex = i;
      context.progress.currentDate = new Date(candle.timestamp);

      // Update progress
      progress.currentCandle = i;
      progress.percentage = Math.round((i / historicalData.length) * 100);
      progress.currentDate = new Date(candle.timestamp);
      progress.currentEquity = context.equity;

      // Update positions with current price
      this.updatePositions(context, candle);

      // Get strategy signals
      try {
        const signals = await strategy.onCandle(candle, context);

        if (signals && signals.length > 0) {
          result.metadata.signalsGenerated += signals.length;

          // Execute signals
          for (const signal of signals) {
            const trade = await this.executeSignal(signal, candle, context, config);
            if (trade) {
              context.trades.push(trade);
              result.trades.push(trade);
              progress.recentTrades.push(trade);

              // Keep only last 10 trades for progress
              if (progress.recentTrades.length > 10) {
                progress.recentTrades.shift();
              }

              // Call strategy onTrade if available
              if (strategy.onTrade) {
                await strategy.onTrade(trade, context);
              }

              // Emit trade event
              this.emit('trade', {
                type: 'TRADE',
                backtestId: result.backtestId,
                data: {
                  trade,
                  equity: context.equity,
                  drawdown: this.calculateCurrentDrawdown(context)
                },
                timestamp: Date.now()
              } as BacktestEvent);
            }
          }
        }
      } catch (error) {
        apiLogger.warn('Strategy signal generation failed', {
          backtestId: result.backtestId,
          candleIndex: i,
          timestamp: candle.timestamp,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Update previous candles (keep last 100 for indicators)
      context.previousCandles.push(candle);
      if (context.previousCandles.length > 100) {
        context.previousCandles.shift();
      }

      result.metadata.candlesProcessed = i + 1;

      // Emit progress every 1% or every 1000 candles
      if (i % Math.max(1, Math.floor(historicalData.length / 100)) === 0 || i % 1000 === 0) {
        progress.currentDrawdown = this.calculateCurrentDrawdown(context);
        this.updateProgress(progress);
      }
    }

    // Close any remaining open positions
    this.closeAllPositions(context, historicalData[historicalData.length - 1]);

    // Calculate final performance metrics
    const performance = this.calculatePerformanceMetrics(context, config);

    // Update result with final data
    result.positions = context.positions;

    return performance;
  }

  /**
   * Execute a trading signal
   */
  private async executeSignal(
    signal: BacktestSignal,
    candle: BacktestCandle,
    context: BacktestContext,
    config: BacktestConfiguration
  ): Promise<BacktestTrade | null> {
    try {
      const price = signal.price || candle.close;
      const slippage = price * (config.slippage || 0.0001); // Default 0.01% slippage
      const actualPrice = signal.type === 'BUY' ? price + slippage : price - slippage;

      let quantity = 0;

      if (signal.quantity) {
        quantity = signal.quantity;
      } else if (signal.percentage) {
        const availableCapital = signal.type === 'BUY' ? context.availableCash :
          this.getPositionQuantity(context, signal.symbol, signal.type === 'SELL' ? 'LONG' : 'SHORT');
        quantity = Math.floor((availableCapital * signal.percentage) / actualPrice);
      } else {
        // Default to risk per trade
        const riskAmount = context.equity * (config.riskPerTrade || 0.01);
        quantity = Math.floor(riskAmount / actualPrice);
      }

      if (quantity <= 0) {
        return null;
      }

      const totalCost = quantity * actualPrice;
      const commission = totalCost * (config.commission || 0.001); // Default 0.1% commission

      // Check if we have enough capital for buy orders
      if ((signal.type === 'BUY') && (totalCost + commission > context.availableCash)) {
        return null;
      }

      // Create trade
      const trade: BacktestTrade = {
        id: uuidv4(),
        timestamp: candle.timestamp,
        type: signal.type,
        symbol: signal.symbol,
        quantity,
        price: actualPrice,
        commission,
        slippage,
        reason: signal.reason,
        strategySignal: signal
      };

      // Update context based on trade type
      if (signal.type === 'BUY') {
        context.availableCash -= (totalCost + commission);
        this.openPosition(context, trade, signal);
      } else if (signal.type === 'SELL') {
        context.availableCash += (totalCost - commission);
        this.closePosition(context, trade, signal);
      }

      // Update equity
      context.equity = this.calculateTotalEquity(context, candle);

      return trade;

    } catch (error) {
      apiLogger.error('Failed to execute signal', error as Error, {
        signal,
        candle: { timestamp: candle.timestamp, price: candle.close }
      });
      return null;
    }
  }

  /**
   * Open a new position
   */
  private openPosition(context: BacktestContext, trade: BacktestTrade, signal: BacktestSignal): void {
    const position: BacktestPosition = {
      symbol: trade.symbol,
      side: trade.type === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: trade.price,
      entryTime: trade.timestamp,
      quantity: trade.quantity,
      unrealizedPnL: 0,
      commission: trade.commission,
      maxDrawdown: 0,
      maxProfit: 0,
      isOpen: true,
      trades: [trade]
    };

    context.positions.push(position);
    context.openPositions.push(position);
  }

  /**
   * Close a position
   */
  private closePosition(context: BacktestContext, trade: BacktestTrade, signal: BacktestSignal): void {
    // Find matching open position
    const positionIndex = context.openPositions.findIndex(
      pos => pos.symbol === trade.symbol &&
            ((trade.type === 'SELL' && pos.side === 'LONG') ||
             (trade.type === 'BUY' && pos.side === 'SHORT'))
    );

    if (positionIndex >= 0) {
      const position = context.openPositions[positionIndex];

      // Update position
      position.exitPrice = trade.price;
      position.exitTime = trade.timestamp;
      position.duration = trade.timestamp - position.entryTime;
      position.isOpen = false;
      position.trades.push(trade);
      position.commission += trade.commission;

      // Calculate realized P&L
      if (position.side === 'LONG') {
        position.realizedPnL = (trade.price - position.entryPrice) * position.quantity - position.commission;
      } else {
        position.realizedPnL = (position.entryPrice - trade.price) * position.quantity - position.commission;
      }

      // Remove from open positions
      context.openPositions.splice(positionIndex, 1);
    }
  }

  /**
   * Update positions with current market price
   */
  private updatePositions(context: BacktestContext, candle: BacktestCandle): void {
    for (const position of context.openPositions) {
      if (position.symbol === candle.symbol) {
        // Calculate unrealized P&L
        if (position.side === 'LONG') {
          position.unrealizedPnL = (candle.close - position.entryPrice) * position.quantity - position.commission;
        } else {
          position.unrealizedPnL = (position.entryPrice - candle.close) * position.quantity - position.commission;
        }

        // Update max profit and drawdown
        position.maxProfit = Math.max(position.maxProfit, position.unrealizedPnL);
        position.maxDrawdown = Math.min(position.maxDrawdown, position.unrealizedPnL);
      }
    }
  }

  /**
   * Close all open positions at the end of backtest
   */
  private closeAllPositions(context: BacktestContext, finalCandle: BacktestCandle): void {
    for (const position of [...context.openPositions]) {
      const closeSignal: BacktestSignal = {
        type: position.side === 'LONG' ? 'SELL' : 'BUY',
        symbol: position.symbol,
        quantity: position.quantity,
        reason: 'End of backtest period'
      };

      const closeTrade: BacktestTrade = {
        id: uuidv4(),
        timestamp: finalCandle.timestamp,
        type: closeSignal.type,
        symbol: position.symbol,
        quantity: position.quantity,
        price: finalCandle.close,
        commission: finalCandle.close * position.quantity * 0.001,
        slippage: 0,
        reason: closeSignal.reason
      };

      context.trades.push(closeTrade);
      this.closePosition(context, closeTrade, closeSignal);
    }

    // Update final equity
    context.equity = this.calculateTotalEquity(context, finalCandle);
  }

  /**
   * Calculate total equity including open positions
   */
  private calculateTotalEquity(context: BacktestContext, candle: BacktestCandle): number {
    let totalEquity = context.availableCash;

    for (const position of context.openPositions) {
      if (position.symbol === candle.symbol) {
        const currentValue = position.quantity * candle.close;
        totalEquity += currentValue;
      }
    }

    return totalEquity;
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformanceMetrics(
    context: BacktestContext,
    config: BacktestConfiguration
  ): BacktestPerformanceMetrics {
    const finalEquity = context.equity;
    const initialCapital = config.initialCapital;
    const totalReturn = finalEquity - initialCapital;
    const totalReturnPercentage = (totalReturn / initialCapital) * 100;

    // Calculate trade statistics
    const closedPositions = context.positions.filter(pos => !pos.isOpen);
    const wins = closedPositions.filter(pos => (pos.realizedPnL || 0) > 0);
    const losses = closedPositions.filter(pos => (pos.realizedPnL || 0) < 0);

    const winRate = closedPositions.length > 0 ? (wins.length / closedPositions.length) * 100 : 0;
    const averageWin = wins.length > 0 ? wins.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0) / losses.length) : 0;
    const profitLossRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

    // Calculate drawdown
    const returns = this.calculateReturns(context, config);
    const drawdowns = this.calculateDrawdowns(returns);
    const maxDrawdown = Math.min(...drawdowns);
    const maxDrawdownPercentage = (maxDrawdown / initialCapital) * 100;

    // Calculate risk-adjusted metrics
    const dailyReturns = this.calculateDailyReturns(returns);
    const volatility = this.calculateVolatility(dailyReturns);
    const riskFreeRate = 0.02; // 2% annual risk-free rate
    const sharpeRatio = volatility > 0 ? (totalReturnPercentage - riskFreeRate) / volatility : 0;

    // Calculate duration
    const startTime = new Date(config.startDate).getTime();
    const endTime = new Date(config.endDate).getTime();
    const durationDays = (endTime - startTime) / (1000 * 60 * 60 * 24);
    const annualizedReturn = totalReturnPercentage * (365 / durationDays);

    return {
      totalReturn,
      totalReturnPercentage,
      annualizedReturn,
      maxDrawdown: Math.abs(maxDrawdown),
      maxDrawdownPercentage: Math.abs(maxDrawdownPercentage),
      sharpeRatio,
      sortinoRatio: this.calculateSortinoRatio(dailyReturns, riskFreeRate),
      calmarRatio: Math.abs(maxDrawdownPercentage) > 0 ? annualizedReturn / Math.abs(maxDrawdownPercentage) : 0,
      volatility,
      winRate,
      profitLossRatio,
      averageWin,
      averageLoss,
      largestWin: wins.length > 0 ? Math.max(...wins.map(pos => pos.realizedPnL || 0)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(pos => pos.realizedPnL || 0)) : 0,
      totalTrades: context.trades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      averageTradeDuration: closedPositions.length > 0 ?
        closedPositions.reduce((sum, pos) => sum + (pos.duration || 0), 0) / closedPositions.length : 0,
      totalCommissions: context.trades.reduce((sum, trade) => sum + trade.commission, 0),
      totalSlippage: context.trades.reduce((sum, trade) => sum + trade.slippage, 0),
      initialCapital,
      finalCapital: finalEquity,
      timeframe: config.timeframe,
      period: {
        start: new Date(config.startDate),
        end: new Date(config.endDate),
        durationDays
      }
    };
  }

  // Additional helper methods for calculations...
  private getDefaultPerformanceMetrics(): BacktestPerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPercentage: 0,
      annualizedReturn: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      volatility: 0,
      winRate: 0,
      profitLossRatio: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageTradeDuration: 0,
      totalCommissions: 0,
      totalSlippage: 0,
      initialCapital: 10000,
      finalCapital: 10000,
      timeframe: '1h',
      period: {
        start: new Date(),
        end: new Date(),
        durationDays: 0
      }
    };
  }

  private getDefaultRiskMetrics(): BacktestRiskMetrics {
    return {
      valueAtRisk: 0,
      expectedShortfall: 0,
      maxConsecutiveLosses: 0,
      maxConsecutiveWins: 0,
      downsideDeviation: 0,
      recoveryFactor: 0,
      payoffRatio: 0,
      profitFactor: 0,
      kellyPercentage: 0,
      informationRatio: 0,
      treynorRatio: 0,
      beta: 0,
      alpha: 0,
      correlation: 0
    };
  }

  private getDefaultBacktestResult(): BacktestResult {
    return {
      id: '',
      backtestId: '',
      strategyId: '',
      symbol: '',
      timeframe: '',
      status: 'FAILED',
      startTime: new Date(),
      configuration: {} as BacktestConfiguration,
      performance: this.getDefaultPerformanceMetrics(),
      riskMetrics: this.getDefaultRiskMetrics(),
      equityCurve: [],
      monthlyReturns: [],
      positions: [],
      trades: [],
      metadata: {
        candlesProcessed: 0,
        signalsGenerated: 0,
        executionTime: 0,
        memoryUsage: 0,
        version: '1.0.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Implement remaining interface methods...
  async getBacktest(backtestId: string): Promise<BacktestResult | null> {
    return this.completedBacktests.get(backtestId) || null;
  }

  async cancelBacktest(backtestId: string): Promise<boolean> {
    if (this.runningBacktests.has(backtestId)) {
      this.runningBacktests.delete(backtestId);
      this.stats.runningBacktests--;
      return true;
    }
    return false;
  }

  async getStatistics(): Promise<BacktestStatistics> {
    return this.stats;
  }

  // Placeholder implementations for complex methods
  private async fetchHistoricalData(config: BacktestConfiguration): Promise<BacktestCandle[]> {
    // Use market data service to fetch historical data
    const result = await marketDataService.getHistoricalData({
      symbol: config.symbol,
      timeframe: config.timeframe,
      startTime: new Date(config.startDate).getTime(),
      endTime: new Date(config.endDate).getTime(),
      limit: 10000
    });

    return result.data.map(candle => ({
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      symbol: candle.symbol,
      timeframe: candle.timeframe
    }));
  }

  private async loadStrategy(strategyId: string): Promise<BacktestStrategy | null> {
    try {
      const strategyData = await strategyDataService.getStrategyById(strategyId);
      if (!strategyData) return null;

      // Create a basic strategy implementation
      // In production, this would dynamically load and execute the strategy code
      const strategy: BacktestStrategy = {
        id: strategyId,
        name: strategyData.name,
        code: strategyData.code || '',
        parameters: strategyData.parameters || {},
        onCandle: async (candle: BacktestCandle, context: BacktestContext): Promise<BacktestSignal[]> => {
          // Simple moving average crossover strategy as example
          const signals: BacktestSignal[] = [];

          if (context.previousCandles.length >= 20) {
            const sma10 = this.calculateSMA(context.previousCandles.slice(-10));
            const sma20 = this.calculateSMA(context.previousCandles.slice(-20));
            const prevSma10 = this.calculateSMA(context.previousCandles.slice(-11, -1));
            const prevSma20 = this.calculateSMA(context.previousCandles.slice(-21, -1));

            // Buy signal: SMA10 crosses above SMA20
            if (sma10 > sma20 && prevSma10 <= prevSma20 && context.openPositions.length === 0) {
              signals.push({
                type: 'BUY',
                symbol: candle.symbol,
                percentage: 0.1, // 10% of equity
                reason: 'SMA crossover bullish'
              });
            }

            // Sell signal: SMA10 crosses below SMA20
            if (sma10 < sma20 && prevSma10 >= prevSma20 && context.openPositions.length > 0) {
              signals.push({
                type: 'SELL',
                symbol: candle.symbol,
                quantity: context.openPositions[0]?.quantity || 0,
                reason: 'SMA crossover bearish'
              });
            }
          }

          return signals;
        }
      };

      return strategy;
    } catch (error) {
      apiLogger.error('Failed to load strategy', error as Error, { strategyId });
      return null;
    }
  }

  private calculateSMA(candles: BacktestCandle[]): number {
    if (candles.length === 0) return 0;
    const sum = candles.reduce((acc, candle) => acc + candle.close, 0);
    return sum / candles.length;
  }

  // Placeholder implementations for remaining methods
  private calculateRiskMetrics(result: BacktestResult): BacktestRiskMetrics {
    return this.getDefaultRiskMetrics();
  }

  private generateEquityCurve(result: BacktestResult): BacktestEquityCurve[] {
    return [];
  }

  private generateMonthlyReturns(result: BacktestResult): BacktestMonthlyReturns[] {
    return [];
  }

  private calculateReturns(context: BacktestContext, config: BacktestConfiguration): number[] {
    return [];
  }

  private calculateDrawdowns(returns: number[]): number[] {
    return [];
  }

  private calculateDailyReturns(returns: number[]): number[] {
    return [];
  }

  private calculateVolatility(returns: number[]): number {
    return 0;
  }

  private calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    return 0;
  }

  private calculateCurrentDrawdown(context: BacktestContext): number {
    return 0;
  }

  private getPositionQuantity(context: BacktestContext, symbol: string, side: string): number {
    const position = context.openPositions.find(pos => pos.symbol === symbol && pos.side === side);
    return position?.quantity || 0;
  }

  private updateProgress(progress: BacktestProgress): void {
    this.runningBacktests.set(progress.backtestId, progress);

    this.emit('progress', {
      type: 'PROGRESS',
      backtestId: progress.backtestId,
      data: progress,
      timestamp: Date.now()
    } as BacktestEvent);
  }

  private updateAverageExecutionTime(duration: number): void {
    const total = this.stats.averageExecutionTime * (this.stats.completedBacktests - 1) + duration;
    this.stats.averageExecutionTime = total / this.stats.completedBacktests;
  }

  private updateTopPerformers(result: BacktestResult): void {
    this.stats.topPerformers.push(result);
    this.stats.topPerformers.sort((a, b) => b.performance.totalReturnPercentage - a.performance.totalReturnPercentage);
    this.stats.topPerformers = this.stats.topPerformers.slice(0, 10); // Keep top 10
  }

  /**
   * Get historical data for DSL backtest
   */
  private async getHistoricalDataForDSL(dsl: StrategyDSL, startDate: Date, endDate: Date): Promise<any[]> {
    const result = await marketDataService.getHistoricalData({
      symbol: dsl.symbol,
      timeframe: dsl.timeframe,
      startTime: startDate.getTime(),
      endTime: endDate.getTime(),
      limit: 10000
    });

    return result.data;
  }

  /**
   * Convert Strategy Execution Result to Backtest Result format
   */
  private convertExecutionResultToBacktestResult(backtestId: string, executionResult: any, dsl: StrategyDSL): BacktestResult {
    const result: BacktestResult = {
      id: uuidv4(),
      backtestId,
      strategyId: `dsl_${dsl.strategy_name}`,
      symbol: dsl.symbol,
      timeframe: dsl.timeframe,
      status: executionResult.success ? 'COMPLETED' : 'FAILED',
      startTime: new Date(),
      configuration: {
        strategyId: `dsl_${dsl.strategy_name}`,
        symbol: dsl.symbol,
        timeframe: dsl.timeframe,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        initialCapital: 100000,
        commission: dsl.execution.commission,
        slippage: dsl.execution.slippage,
        parameters: dsl.params || {}
      },
      performance: {
        totalReturn: executionResult.totalPnL,
        totalReturnPercentage: executionResult.totalPnLPercentage,
        annualizedReturn: executionResult.totalPnLPercentage,
        maxDrawdown: executionResult.maxDrawdown,
        maxDrawdownPercentage: executionResult.maxDrawdownPercentage,
        sharpeRatio: executionResult.sharpeRatio,
        sortinoRatio: 0,
        calmarRatio: 0,
        volatility: 0,
        winRate: executionResult.winRate,
        profitLossRatio: executionResult.profitFactor,
        averageWin: executionResult.averageWin,
        averageLoss: Math.abs(executionResult.averageLoss),
        largestWin: executionResult.largestWin,
        largestLoss: Math.abs(executionResult.largestLoss),
        totalTrades: executionResult.totalTrades,
        winningTrades: executionResult.winningTrades,
        losingTrades: executionResult.losingTrades,
        averageTradeDuration: executionResult.averageHoldingTime,
        totalCommissions: 0,
        totalSlippage: 0,
        initialCapital: 100000,
        finalCapital: 100000 + executionResult.totalPnL,
        timeframe: dsl.timeframe,
        period: {
          start: new Date(),
          end: new Date(),
          durationDays: 30
        }
      },
      riskMetrics: this.getDefaultRiskMetrics(),
      equityCurve: executionResult.equityCurve || [],
      monthlyReturns: executionResult.monthlyReturns || [],
      positions: this.convertTradesToPositions(executionResult.trades),
      trades: this.convertStrategyTradesToBacktestTrades(executionResult.trades),
      metadata: {
        candlesProcessed: executionResult.candlesProcessed,
        signalsGenerated: executionResult.signals?.length || 0,
        executionTime: executionResult.executionTime,
        memoryUsage: 0,
        version: '2.0.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return result;
  }

  /**
   * Convert strategy trades to backtest trades
   */
  private convertStrategyTradesToBacktestTrades(strategyTrades: any[]): BacktestTrade[] {
    return strategyTrades.map(trade => ({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side.toUpperCase(),
      entryTime: trade.entryTime,
      entryPrice: trade.entryPrice,
      exitTime: trade.exitTime,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      pnl: trade.pnl,
      pnlPercentage: trade.pnlPercentage,
      commission: trade.commission,
      slippage: trade.slippage,
      reason: trade.entryReason,
      holdingTime: trade.holdingTime
    }));
  }

  /**
   * Convert trades to positions (simplified)
   */
  private convertTradesToPositions(trades: any[]): BacktestPosition[] {
    return trades.map(trade => ({
      id: `pos_${trade.id}`,
      symbol: trade.symbol,
      side: trade.side.toUpperCase(),
      entryTime: trade.entryTime,
      entryPrice: trade.entryPrice,
      quantity: trade.quantity,
      currentPrice: trade.exitPrice,
      unrealizedPnL: 0,
      realizedPnL: trade.pnl,
      isOpen: false,
      margin: 0,
      leverage: 1,
      duration: trade.holdingTime
    }));
  }

  // Placeholder for complex optimization and comparison methods
  async optimizeStrategy(optimization: BacktestOptimization): Promise<BacktestOptimizationResult[]> {
    throw new Error('Strategy optimization not yet implemented');
  }

  async compareBacktests(backtestIds: string[]): Promise<BacktestComparison> {
    throw new Error('Backtest comparison not yet implemented');
  }
}

// Singleton instance
export const backtestingEngine = new BacktestingEngine();