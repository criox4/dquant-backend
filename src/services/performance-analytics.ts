/**
 * Performance Analytics Service - Advanced Trading Performance Analysis
 * Provides comprehensive metrics, risk analysis, and strategy performance evaluation
 */

import { EventEmitter } from 'events';
import {
  PerformanceMetrics,
  RiskMetrics,
  StrategyPerformance,
  PortfolioAnalytics,
  EquityPoint,
  DrawdownPoint,
  MonthlyReturn,
  RollingMetrics,
  TradeAnalysis,
  BenchmarkComparison,
  PerformanceAnalyticsService as IPerformanceAnalyticsService,
  StrategyComparison,
  PerformanceAlert,
  AlertConfiguration,
  AnalyticsConfig,
  StatisticalSummary,
  DrawdownPeriod,
  SymbolPerformance,
  TimePerformance,
  MonteCarloResult
} from '@/types/performance-analytics';
import { prisma } from '@/config/database';
import { marketDataService } from '@/services/market-data';
import { paperTradingWebSocket } from '@/services/paper-trading-websocket';
import { tradingLogger } from '@/services/logger';

export class PerformanceAnalyticsService extends EventEmitter implements IPerformanceAnalyticsService {
  private analyticsCache = new Map<string, any>();
  private activeCalculations = new Set<string>();
  private realTimeTimers = new Map<string, NodeJS.Timeout>();

  private config: AnalyticsConfig = {
    calculationPeriods: [7, 30, 90, 180, 365],
    riskFreeRate: 0.02, // 2% annual risk-free rate
    benchmarkSymbol: 'BTCUSDT',
    confidenceLevels: [0.95, 0.99],
    enableRealTimeCalculation: true,
    calculationFrequency: 60, // 1 minute
    historicalDataDays: 365,
    maxDrawdownAlert: -0.10, // -10%
    sharpeRatioAlert: 0.5,
    winRateAlert: 0.4, // 40%
    enableMonteCarloSimulation: false,
    monteCarloIterations: 1000,
    enableStressTests: false,
    stressTestScenarios: ['market_crash', 'volatility_spike', 'liquidity_crisis']
  };

  constructor() {
    super();
    tradingLogger.info('Performance Analytics Service initialized');
  }

  /**
   * Calculate comprehensive performance metrics for an account
   */
  async calculatePerformanceMetrics(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceMetrics> {
    const cacheKey = `metrics_${accountId}_${startDate?.getTime()}_${endDate?.getTime()}`;

    if (this.analyticsCache.has(cacheKey)) {
      return this.analyticsCache.get(cacheKey);
    }

    try {
      tradingLogger.info('Calculating performance metrics', { accountId, startDate, endDate });

      // Get account data
      const account = await this.getAccountData(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get trades and positions data
      const trades = await this.getTradesData(accountId, startDate, endDate);
      const positions = await this.getPositionsData(accountId, startDate, endDate);
      const equityCurve = await this.generateEquityCurve(accountId, startDate, endDate);

      // Calculate basic metrics
      const totalReturn = this.calculateTotalReturn(account, trades);
      const returns = this.calculateReturns(equityCurve);
      const drawdowns = this.calculateDrawdowns(equityCurve);

      const metrics: PerformanceMetrics = {
        // Return Metrics
        totalReturn,
        totalReturnPercentage: (totalReturn / account.initialBalance) * 100,
        annualizedReturn: this.calculateAnnualizedReturn(returns, this.getDaysBetween(startDate, endDate)),
        cumulativeReturn: totalReturn,

        // Risk Metrics
        sharpeRatio: this.calculateSharpeRatio(returns),
        sortinRatio: this.calculateSortinRatio(returns),
        calmarRatio: this.calculateCalmarRatio(returns, drawdowns),
        maximumDrawdown: Math.min(...drawdowns),
        maximumDrawdownPercentage: (Math.min(...drawdowns) / Math.max(...equityCurve.map(p => p.equity))) * 100,
        averageDrawdown: this.calculateMean(drawdowns.filter(d => d < 0)),
        volatility: this.calculateVolatility(returns),
        valueAtRisk: this.calculateVaR(returns, 0.95),
        conditionalValueAtRisk: this.calculateCVaR(returns, 0.95),

        // Trade Statistics
        totalTrades: trades.length,
        winningTrades: trades.filter(t => t.realizedPnl > 0).length,
        losingTrades: trades.filter(t => t.realizedPnl < 0).length,
        winRate: trades.length > 0 ? (trades.filter(t => t.realizedPnl > 0).length / trades.length) : 0,
        lossRate: trades.length > 0 ? (trades.filter(t => t.realizedPnl < 0).length / trades.length) : 0,
        averageWin: this.calculateMean(trades.filter(t => t.realizedPnl > 0).map(t => t.realizedPnl)),
        averageLoss: this.calculateMean(trades.filter(t => t.realizedPnl < 0).map(t => t.realizedPnl)),
        largestWin: Math.max(...trades.map(t => t.realizedPnl), 0),
        largestLoss: Math.min(...trades.map(t => t.realizedPnl), 0),
        profitFactor: this.calculateProfitFactor(trades),

        // Time-based Metrics
        averageHoldingTime: this.calculateAverageHoldingTime(positions),
        averageTimeToProfit: this.calculateAverageTimeToProfit(trades),
        averageTimeToLoss: this.calculateAverageTimeToLoss(trades),
        tradingFrequency: this.calculateTradingFrequency(trades, this.getDaysBetween(startDate, endDate)),

        // Additional Metrics
        expectancy: this.calculateExpectancy(trades),
        kelly: this.calculateKellyPercentage(trades),
        ulcerIndex: this.calculateUlcerIndex(equityCurve),
        recoveryFactor: this.calculateRecoveryFactor(totalReturn, Math.min(...drawdowns)),

        // Period Information
        startDate: startDate || new Date(Math.min(...trades.map(t => t.timestamp.getTime()))),
        endDate: endDate || new Date(),
        totalDays: this.getDaysBetween(startDate, endDate),
        tradingDays: this.getTradingDays(trades)
      };

      // Cache results
      this.analyticsCache.set(cacheKey, metrics);
      setTimeout(() => this.analyticsCache.delete(cacheKey), 300000); // 5 minute cache

      tradingLogger.debug('Performance metrics calculated', {
        accountId,
        totalReturn: metrics.totalReturn,
        sharpeRatio: metrics.sharpeRatio,
        winRate: metrics.winRate
      });

      return metrics;

    } catch (error) {
      tradingLogger.error('Error calculating performance metrics', error as Error);
      throw error;
    }
  }

  /**
   * Calculate comprehensive risk metrics
   */
  async calculateRiskMetrics(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RiskMetrics> {
    try {
      const equityCurve = await this.generateEquityCurve(accountId, startDate, endDate);
      const returns = this.calculateReturns(equityCurve);
      const drawdowns = this.calculateDrawdowns(equityCurve);
      const drawdownPeriods = this.calculateDrawdownPeriods(equityCurve);

      // Get benchmark data for beta/alpha calculations
      const benchmarkReturns = await this.getBenchmarkReturns(startDate, endDate);

      const riskMetrics: RiskMetrics = {
        // Drawdown Analysis
        drawdowns: drawdownPeriods,
        currentDrawdown: drawdowns[drawdowns.length - 1] || 0,
        currentDrawdownDuration: this.getCurrentDrawdownDuration(equityCurve),
        maxDrawdownDuration: Math.max(...drawdownPeriods.map(d => d.duration), 0),

        // Risk Ratios
        sharpeRatio: this.calculateSharpeRatio(returns),
        sortinRatio: this.calculateSortinRatio(returns),
        calmarRatio: this.calculateCalmarRatio(returns, drawdowns),
        sterlingRatio: this.calculateSterlingRatio(returns, drawdowns),
        burkeRatio: this.calculateBurkeRatio(returns, drawdowns),

        // Volatility Metrics
        volatility: this.calculateVolatility(returns),
        downwardVolatility: this.calculateDownwardVolatility(returns),
        upwardVolatility: this.calculateUpwardVolatility(returns),
        beta: this.calculateBeta(returns, benchmarkReturns),
        alpha: this.calculateAlpha(returns, benchmarkReturns),

        // Value at Risk
        var95: this.calculateVaR(returns, 0.95),
        var99: this.calculateVaR(returns, 0.99),
        cvar95: this.calculateCVaR(returns, 0.95),
        cvar99: this.calculateCVaR(returns, 0.99),

        // Risk-adjusted Returns
        treynorRatio: this.calculateTreynorRatio(returns, benchmarkReturns),
        informationRatio: this.calculateInformationRatio(returns, benchmarkReturns),
        trackingError: this.calculateTrackingError(returns, benchmarkReturns),

        // Tail Risk
        skewness: this.calculateSkewness(returns),
        kurtosis: this.calculateKurtosis(returns),
        tailRatio: this.calculateTailRatio(returns)
      };

      return riskMetrics;

    } catch (error) {
      tradingLogger.error('Error calculating risk metrics', error as Error);
      throw error;
    }
  }

  /**
   * Generate equity curve for visualization and analysis
   */
  async generateEquityCurve(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EquityPoint[]> {
    try {
      const account = await this.getAccountData(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get all closed positions chronologically (representing completed trades)
      const trades = await this.getTradesData(accountId, startDate, endDate);

      const equityCurve: EquityPoint[] = [];
      let runningEquity = account.initialBalance;
      let runningTrades = 0;
      let previousHigh = runningEquity;

      // Add initial point
      equityCurve.push({
        timestamp: startDate || account.createdAt,
        equity: runningEquity,
        drawdown: 0,
        trades: 0,
        returns: 0
      });

      // Process each trade
      for (const trade of trades) {
        runningEquity += trade.realizedPnl;
        runningTrades++;

        if (runningEquity > previousHigh) {
          previousHigh = runningEquity;
        }

        const drawdown = runningEquity - previousHigh;
        const returns = runningEquity - parseFloat(account.initialBalance.toString());

        equityCurve.push({
          timestamp: trade.timestamp,
          equity: runningEquity,
          drawdown,
          trades: runningTrades,
          returns
        });
      }

      return equityCurve;

    } catch (error) {
      tradingLogger.error('Error generating equity curve', error as Error);
      throw error;
    }
  }

  /**
   * Generate drawdown curve for analysis
   */
  async generateDrawdownCurve(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DrawdownPoint[]> {
    try {
      const equityCurve = await this.generateEquityCurve(accountId, startDate, endDate);
      const drawdownCurve: DrawdownPoint[] = [];

      let highWaterMark = equityCurve[0]?.equity || 0;
      let daysSinceHigh = 0;

      for (const point of equityCurve) {
        const isNewHigh = point.equity > highWaterMark;

        if (isNewHigh) {
          highWaterMark = point.equity;
          daysSinceHigh = 0;
        } else {
          daysSinceHigh++;
        }

        const drawdown = point.equity - highWaterMark;
        const drawdownPercentage = highWaterMark > 0 ? (drawdown / highWaterMark) * 100 : 0;

        drawdownCurve.push({
          timestamp: point.timestamp,
          drawdown,
          drawdownPercentage,
          isNewHigh,
          daysSinceHigh
        });
      }

      return drawdownCurve;

    } catch (error) {
      tradingLogger.error('Error generating drawdown curve', error as Error);
      throw error;
    }
  }

  /**
   * Calculate rolling metrics over time
   */
  async calculateRollingMetrics(accountId: string, period: number): Promise<RollingMetrics[]> {
    try {
      const equityCurve = await this.generateEquityCurve(accountId);
      const rollingMetrics: RollingMetrics[] = [];

      for (let i = period; i < equityCurve.length; i++) {
        const windowData = equityCurve.slice(i - period, i);
        const returns = this.calculateReturns(windowData);
        const drawdowns = this.calculateDrawdowns(windowData);

        const windowTrades = windowData[windowData.length - 1].trades - windowData[0].trades;
        const windowWins = this.countWinsInWindow(windowData);

        rollingMetrics.push({
          date: equityCurve[i].timestamp,
          period,
          returns: windowData[windowData.length - 1].returns - windowData[0].returns,
          volatility: this.calculateVolatility(returns),
          sharpeRatio: this.calculateSharpeRatio(returns),
          maxDrawdown: Math.min(...drawdowns),
          winRate: windowTrades > 0 ? windowWins / windowTrades : 0
        });
      }

      return rollingMetrics;

    } catch (error) {
      tradingLogger.error('Error calculating rolling metrics', error as Error);
      throw error;
    }
  }

  /**
   * Start real-time analytics updates
   */
  async startRealTimeAnalytics(accountId: string): Promise<void> {
    if (this.realTimeTimers.has(accountId)) {
      return; // Already running
    }

    const timer = setInterval(async () => {
      try {
        await this.updateRealTimeAnalytics(accountId);
      } catch (error) {
        tradingLogger.error('Error in real-time analytics update', error as Error);
      }
    }, this.config.calculationFrequency * 1000);

    this.realTimeTimers.set(accountId, timer);
    tradingLogger.info('Started real-time analytics', { accountId });
  }

  /**
   * Stop real-time analytics updates
   */
  async stopRealTimeAnalytics(accountId: string): Promise<void> {
    const timer = this.realTimeTimers.get(accountId);
    if (timer) {
      clearInterval(timer);
      this.realTimeTimers.delete(accountId);
      tradingLogger.info('Stopped real-time analytics', { accountId });
    }
  }

  /**
   * Update real-time analytics and broadcast via WebSocket
   */
  private async updateRealTimeAnalytics(accountId: string): Promise<void> {
    try {
      const metrics = await this.calculatePerformanceMetrics(accountId);
      const riskMetrics = await this.calculateRiskMetrics(accountId);
      const alerts = await this.checkPerformanceAlerts(accountId);

      // Broadcast performance update
      await paperTradingWebSocket.broadcastPerformanceUpdate(accountId, {
        dailyPnL: metrics.totalReturn,
        totalPnL: metrics.totalReturn,
        winRate: metrics.winRate,
        totalTrades: metrics.totalTrades,
        currentDrawdown: riskMetrics.currentDrawdown
      });

      // Emit analytics update event
      this.emit('analyticsUpdate', {
        type: 'PERFORMANCE_UPDATE',
        accountId,
        data: { metrics, riskMetrics, alerts },
        timestamp: new Date()
      });

    } catch (error) {
      tradingLogger.error('Error updating real-time analytics', error as Error);
    }
  }

  /**
   * Check for performance alerts
   */
  async checkPerformanceAlerts(accountId: string): Promise<PerformanceAlert[]> {
    try {
      const metrics = await this.calculatePerformanceMetrics(accountId);
      const riskMetrics = await this.calculateRiskMetrics(accountId);
      const alerts: PerformanceAlert[] = [];

      // Check drawdown alert
      if (riskMetrics.currentDrawdown < this.config.maxDrawdownAlert) {
        alerts.push({
          id: `dd_${accountId}_${Date.now()}`,
          type: 'critical',
          title: 'High Drawdown Alert',
          message: `Current drawdown of ${(riskMetrics.currentDrawdown * 100).toFixed(2)}% exceeds threshold`,
          metric: 'drawdown',
          currentValue: riskMetrics.currentDrawdown,
          thresholdValue: this.config.maxDrawdownAlert,
          timestamp: new Date(),
          accountId
        });
      }

      // Check Sharpe ratio alert
      if (metrics.sharpeRatio < this.config.sharpeRatioAlert) {
        alerts.push({
          id: `sr_${accountId}_${Date.now()}`,
          type: 'warning',
          title: 'Low Sharpe Ratio Alert',
          message: `Sharpe ratio of ${metrics.sharpeRatio.toFixed(2)} below threshold`,
          metric: 'sharpe_ratio',
          currentValue: metrics.sharpeRatio,
          thresholdValue: this.config.sharpeRatioAlert,
          timestamp: new Date(),
          accountId
        });
      }

      // Check win rate alert
      if (metrics.winRate < this.config.winRateAlert) {
        alerts.push({
          id: `wr_${accountId}_${Date.now()}`,
          type: 'warning',
          title: 'Low Win Rate Alert',
          message: `Win rate of ${(metrics.winRate * 100).toFixed(1)}% below threshold`,
          metric: 'win_rate',
          currentValue: metrics.winRate,
          thresholdValue: this.config.winRateAlert,
          timestamp: new Date(),
          accountId
        });
      }

      return alerts;

    } catch (error) {
      tradingLogger.error('Error checking performance alerts', error as Error);
      return [];
    }
  }

  // Helper methods for calculations
  private async getAccountData(accountId: string) {
    return await prisma.paperTradingAccount.findUnique({
      where: { accountId }
    });
  }

  private async getTradesData(accountId: string, startDate?: Date, endDate?: Date) {
    // Get trades from closed positions (which represent completed trades)
    const closedPositions = await prisma.paperPosition.findMany({
      where: {
        accountId,
        status: 'CLOSED',
        ...(startDate && { closedAt: { gte: startDate } }),
        ...(endDate && { closedAt: { lte: endDate } })
      },
      orderBy: { closedAt: 'asc' }
    });

    // Convert positions to trade-like objects for analysis
    return closedPositions.map(position => ({
      id: position.id,
      timestamp: position.closedAt || position.openedAt,
      realizedPnl: parseFloat(position.realizedPnl.toString()),
      symbol: position.symbol,
      side: position.side,
      size: parseFloat(position.size.toString()),
      entryPrice: parseFloat(position.entryPrice.toString()),
      exitPrice: parseFloat(position.currentPrice.toString())
    }));
  }

  private async getPositionsData(accountId: string, startDate?: Date, endDate?: Date) {
    return await prisma.paperPosition.findMany({
      where: {
        accountId,
        ...(startDate && { openedAt: { gte: startDate } }),
        ...(endDate && { openedAt: { lte: endDate } })
      }
    });
  }

  private calculateReturns(equityCurve: EquityPoint[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prevEquity = equityCurve[i - 1].equity;
      const currentEquity = equityCurve[i].equity;
      const return_ = prevEquity > 0 ? (currentEquity - prevEquity) / prevEquity : 0;
      returns.push(return_);
    }
    return returns;
  }

  private calculateDrawdowns(equityCurve: EquityPoint[]): number[] {
    return equityCurve.map(point => point.drawdown);
  }

  private calculateTotalReturn(account: any, trades: any[]): number {
    return trades.reduce((sum, trade) => sum + parseFloat(trade.realizedPnl?.toString() || '0'), 0);
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = this.calculateMean(returns);
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    const meanReturn = this.calculateMean(returns);
    const volatility = this.calculateVolatility(returns);
    const riskFreeReturn = this.config.riskFreeRate / 252; // Daily risk-free rate

    return volatility > 0 ? (meanReturn - riskFreeReturn) / volatility * Math.sqrt(252) : 0;
  }

  private calculateSortinRatio(returns: number[]): number {
    const downwardReturns = returns.filter(r => r < 0);
    if (downwardReturns.length === 0) return 0;

    const meanReturn = this.calculateMean(returns);
    const downwardVolatility = this.calculateVolatility(downwardReturns);

    return downwardVolatility > 0 ? meanReturn / downwardVolatility : 0;
  }

  private calculateCalmarRatio(returns: number[], drawdowns: number[]): number {
    const annualizedReturn = this.calculateMean(returns) * 252;
    const maxDrawdown = Math.abs(Math.min(...drawdowns));

    return maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  }

  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    return sortedReturns[index] || 0;
  }

  private calculateCVaR(returns: number[], confidenceLevel: number): number {
    const var_ = this.calculateVaR(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= var_);
    return this.calculateMean(tailReturns);
  }

  private calculateProfitFactor(trades: any[]): number {
    const grossProfit = trades.filter(t => t.realizedPnl > 0)
      .reduce((sum, t) => sum + parseFloat(t.realizedPnl.toString()), 0);
    const grossLoss = Math.abs(trades.filter(t => t.realizedPnl < 0)
      .reduce((sum, t) => sum + parseFloat(t.realizedPnl.toString()), 0));

    return grossLoss > 0 ? grossProfit / grossLoss : 0;
  }

  private calculateExpectancy(trades: any[]): number {
    if (trades.length === 0) return 0;
    const totalPnL = trades.reduce((sum, t) => sum + parseFloat(t.realizedPnl.toString()), 0);
    return totalPnL / trades.length;
  }

  private calculateKellyPercentage(trades: any[]): number {
    if (trades.length === 0) return 0;

    const wins = trades.filter(t => t.realizedPnl > 0);
    const losses = trades.filter(t => t.realizedPnl < 0);

    if (wins.length === 0 || losses.length === 0) return 0;

    const winRate = wins.length / trades.length;
    const avgWin = this.calculateMean(wins.map(t => parseFloat(t.realizedPnl.toString())));
    const avgLoss = Math.abs(this.calculateMean(losses.map(t => parseFloat(t.realizedPnl.toString()))));

    return avgLoss > 0 ? (winRate - ((1 - winRate) / (avgWin / avgLoss))) : 0;
  }

  private getDaysBetween(startDate?: Date, endDate?: Date): number {
    if (!startDate || !endDate) return 365; // Default
    return Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  }

  // Proper implementations for statistical and time-based calculations
  private calculateAnnualizedReturn(returns: number[], days: number): number {
    if (returns.length === 0 || days <= 0) return 0;
    const totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
    return Math.pow(1 + totalReturn, 365 / days) - 1;
  }

  private calculateAverageHoldingTime(positions: any[]): number {
    const closedPositions = positions.filter(p => p.closedAt);
    if (closedPositions.length === 0) return 0;

    const totalHoldingTime = closedPositions.reduce((sum, position) => {
      const holdingTime = (new Date(position.closedAt).getTime() - new Date(position.openedAt).getTime()) / (1000 * 60 * 60); // hours
      return sum + holdingTime;
    }, 0);

    return totalHoldingTime / closedPositions.length;
  }

  private calculateAverageTimeToProfit(trades: any[]): number {
    const profitableTrades = trades.filter(t => t.realizedPnl > 0);
    if (profitableTrades.length === 0) return 0;

    // Estimate time to profit based on timestamp differences
    const avgTime = profitableTrades.reduce((sum, trade, index) => {
      if (index === 0) return sum;
      const timeDiff = (trade.timestamp.getTime() - profitableTrades[index - 1].timestamp.getTime()) / (1000 * 60 * 60);
      return sum + timeDiff;
    }, 0);

    return avgTime / Math.max(profitableTrades.length - 1, 1);
  }

  private calculateAverageTimeToLoss(trades: any[]): number {
    const losingTrades = trades.filter(t => t.realizedPnl < 0);
    if (losingTrades.length === 0) return 0;

    const avgTime = losingTrades.reduce((sum, trade, index) => {
      if (index === 0) return sum;
      const timeDiff = (trade.timestamp.getTime() - losingTrades[index - 1].timestamp.getTime()) / (1000 * 60 * 60);
      return sum + timeDiff;
    }, 0);

    return avgTime / Math.max(losingTrades.length - 1, 1);
  }

  private calculateTradingFrequency(trades: any[], days: number): number {
    return days > 0 ? trades.length / days : 0;
  }

  private calculateUlcerIndex(equityCurve: EquityPoint[]): number {
    if (equityCurve.length === 0) return 0;

    let runningSum = 0;
    let highWaterMark = equityCurve[0].equity;

    for (const point of equityCurve) {
      if (point.equity > highWaterMark) {
        highWaterMark = point.equity;
      }

      const drawdownPercentage = highWaterMark > 0 ? ((point.equity - highWaterMark) / highWaterMark) * 100 : 0;
      runningSum += Math.pow(drawdownPercentage, 2);
    }

    return Math.sqrt(runningSum / equityCurve.length);
  }

  private calculateRecoveryFactor(totalReturn: number, maxDrawdown: number): number {
    return maxDrawdown < 0 ? totalReturn / Math.abs(maxDrawdown) : 0;
  }

  private getTradingDays(trades: any[]): number {
    const uniqueDays = new Set(trades.map(t => t.timestamp.toDateString()));
    return uniqueDays.size;
  }

  private calculateDrawdownPeriods(equityCurve: EquityPoint[]): DrawdownPeriod[] {
    const periods: DrawdownPeriod[] = [];
    let inDrawdown = false;
    let currentPeriod: Partial<DrawdownPeriod> = {};
    let highWaterMark = equityCurve[0]?.equity || 0;

    for (let i = 0; i < equityCurve.length; i++) {
      const point = equityCurve[i];

      if (point.equity > highWaterMark) {
        // New high - end drawdown period if in one
        if (inDrawdown && currentPeriod.startDate) {
          periods.push({
            startDate: currentPeriod.startDate,
            endDate: point.timestamp,
            duration: Math.floor((point.timestamp.getTime() - currentPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24)),
            maxDrawdown: currentPeriod.maxDrawdown || 0,
            maxDrawdownPercentage: ((currentPeriod.maxDrawdown || 0) / highWaterMark) * 100,
            recovery: true,
            recoveryDate: point.timestamp,
            recoveryDuration: Math.floor((point.timestamp.getTime() - currentPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24))
          });
        }

        highWaterMark = point.equity;
        inDrawdown = false;
        currentPeriod = {};
      } else if (point.equity < highWaterMark) {
        // In drawdown
        if (!inDrawdown) {
          // Start new drawdown period
          inDrawdown = true;
          currentPeriod = {
            startDate: point.timestamp,
            maxDrawdown: highWaterMark - point.equity
          };
        } else {
          // Continue drawdown period
          const currentDrawdown = highWaterMark - point.equity;
          if (currentDrawdown > (currentPeriod.maxDrawdown || 0)) {
            currentPeriod.maxDrawdown = currentDrawdown;
          }
        }
      }
    }

    // Handle ongoing drawdown at end
    if (inDrawdown && currentPeriod.startDate) {
      const lastPoint = equityCurve[equityCurve.length - 1];
      periods.push({
        startDate: currentPeriod.startDate,
        endDate: lastPoint.timestamp,
        duration: Math.floor((lastPoint.timestamp.getTime() - currentPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        maxDrawdown: currentPeriod.maxDrawdown || 0,
        maxDrawdownPercentage: ((currentPeriod.maxDrawdown || 0) / highWaterMark) * 100,
        recovery: false
      });
    }

    return periods;
  }

  private getCurrentDrawdownDuration(equityCurve: EquityPoint[]): number {
    return 0; // Placeholder implementation
  }

  private async getBenchmarkReturns(startDate?: Date, endDate?: Date): Promise<number[]> {
    try {
      // For now, simulate benchmark returns using market data service
      // In production, this would fetch actual benchmark (S&P 500, Bitcoin, etc.) data
      const symbol = this.config.benchmarkSymbol;

      // Generate synthetic benchmark returns for demonstration
      // This should be replaced with actual market data retrieval
      const days = this.getDaysBetween(startDate, endDate || new Date());
      const returns: number[] = [];

      for (let i = 0; i < Math.min(days, 365); i++) {
        // Simulate daily returns with slight positive bias (benchmark trend)
        const dailyReturn = (Math.random() - 0.48) * 0.02; // Slightly positive bias
        returns.push(dailyReturn);
      }

      return returns;
    } catch (error) {
      tradingLogger.warn('Could not fetch benchmark returns, using empty array');
      return [];
    }
  }

  private calculateDownwardVolatility(returns: number[]): number {
    const downwardReturns = returns.filter(r => r < 0);
    return this.calculateVolatility(downwardReturns);
  }

  private calculateUpwardVolatility(returns: number[]): number {
    const upwardReturns = returns.filter(r => r > 0);
    return this.calculateVolatility(upwardReturns);
  }

  private calculateBeta(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length === 0 || benchmarkReturns.length === 0) return 1;

    const minLength = Math.min(returns.length, benchmarkReturns.length);
    const portfolioReturns = returns.slice(0, minLength);
    const benchmarkData = benchmarkReturns.slice(0, minLength);

    if (minLength < 2) return 1;

    const portfolioMean = this.calculateMean(portfolioReturns);
    const benchmarkMean = this.calculateMean(benchmarkData);

    let covariance = 0;
    let benchmarkVariance = 0;

    for (let i = 0; i < minLength; i++) {
      const portfolioDiff = portfolioReturns[i] - portfolioMean;
      const benchmarkDiff = benchmarkData[i] - benchmarkMean;

      covariance += portfolioDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }

    covariance /= (minLength - 1);
    benchmarkVariance /= (minLength - 1);

    return benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
  }

  private calculateAlpha(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length === 0 || benchmarkReturns.length === 0) return 0;

    const portfolioMean = this.calculateMean(returns);
    const benchmarkMean = this.calculateMean(benchmarkReturns);
    const beta = this.calculateBeta(returns, benchmarkReturns);
    const riskFreeRate = this.config.riskFreeRate / 252; // Daily risk-free rate

    // Alpha = Portfolio Return - Risk Free Rate - Beta * (Benchmark Return - Risk Free Rate)
    return portfolioMean - riskFreeRate - beta * (benchmarkMean - riskFreeRate);
  }

  private calculateTreynorRatio(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length === 0 || benchmarkReturns.length === 0) return 0;

    const portfolioMean = this.calculateMean(returns);
    const riskFreeRate = this.config.riskFreeRate / 252;
    const beta = this.calculateBeta(returns, benchmarkReturns);

    return beta > 0 ? (portfolioMean - riskFreeRate) / beta : 0;
  }

  private calculateInformationRatio(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length === 0 || benchmarkReturns.length === 0) return 0;

    const minLength = Math.min(returns.length, benchmarkReturns.length);
    const excessReturns: number[] = [];

    for (let i = 0; i < minLength; i++) {
      excessReturns.push(returns[i] - benchmarkReturns[i]);
    }

    const meanExcessReturn = this.calculateMean(excessReturns);
    const trackingError = this.calculateVolatility(excessReturns);

    return trackingError > 0 ? meanExcessReturn / trackingError : 0;
  }

  private calculateTrackingError(returns: number[], benchmarkReturns: number[]): number {
    if (returns.length === 0 || benchmarkReturns.length === 0) return 0;

    const minLength = Math.min(returns.length, benchmarkReturns.length);
    const excessReturns: number[] = [];

    for (let i = 0; i < minLength; i++) {
      excessReturns.push(returns[i] - benchmarkReturns[i]);
    }

    return this.calculateVolatility(excessReturns);
  }

  private calculateSkewness(returns: number[]): number {
    if (returns.length < 3) return 0;

    const mean = this.calculateMean(returns);
    const n = returns.length;

    // Calculate the third moment
    const thirdMoment = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 3);
    }, 0) / n;

    // Calculate standard deviation
    const variance = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 2);
    }, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return thirdMoment / Math.pow(stdDev, 3);
  }

  private calculateKurtosis(returns: number[]): number {
    if (returns.length < 4) return 0;

    const mean = this.calculateMean(returns);
    const n = returns.length;

    // Calculate the fourth moment
    const fourthMoment = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 4);
    }, 0) / n;

    // Calculate standard deviation
    const variance = returns.reduce((sum, ret) => {
      return sum + Math.pow(ret - mean, 2);
    }, 0) / (n - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Excess kurtosis (subtract 3 for normal distribution)
    return (fourthMoment / Math.pow(stdDev, 4)) - 3;
  }

  private calculateTailRatio(returns: number[]): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => b - a);
    const percentile95 = sortedReturns[Math.floor(0.05 * sortedReturns.length)];
    const percentile5 = sortedReturns[Math.floor(0.95 * sortedReturns.length)];

    return percentile5 !== 0 ? Math.abs(percentile95 / percentile5) : 0;
  }

  private calculateSterlingRatio(returns: number[], drawdowns: number[]): number {
    return 0; // Placeholder implementation
  }

  private calculateBurkeRatio(returns: number[], drawdowns: number[]): number {
    return 0; // Placeholder implementation
  }

  private countWinsInWindow(windowData: EquityPoint[]): number {
    return 0; // Placeholder implementation
  }

  // Interface compliance methods - simplified implementations
  async calculateStrategyPerformance(strategyId: string, accountId: string): Promise<StrategyPerformance> {
    throw new Error('Method not implemented');
  }

  async calculatePortfolioAnalytics(accountId: string): Promise<PortfolioAnalytics> {
    throw new Error('Method not implemented');
  }

  async compareStrategies(strategyIds: string[], accountId: string): Promise<StrategyComparison> {
    throw new Error('Method not implemented');
  }

  async compareToBenchmark(accountId: string, benchmarkSymbol: string): Promise<BenchmarkComparison> {
    throw new Error('Method not implemented');
  }

  async generatePerformanceReport(accountId: string, format: 'pdf' | 'html' | 'json'): Promise<string> {
    throw new Error('Method not implemented');
  }

  async exportAnalytics(accountId: string, format: 'csv' | 'xlsx' | 'json'): Promise<Buffer> {
    throw new Error('Method not implemented');
  }

  async configureAlerts(accountId: string, config: AlertConfiguration): Promise<void> {
    throw new Error('Method not implemented');
  }
}

// Singleton instance
export const performanceAnalyticsService = new PerformanceAnalyticsService();