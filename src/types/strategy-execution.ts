/**
 * Strategy Execution Engine Types - DSL Processing and Strategy Automation
 */

import { Candle, Ticker } from '@/types/market-data';
import { PaperTradingSignal } from '@/types/paper-trading';

// Core DSL Structure
export interface StrategyDSL {
  strategy_name: string;
  symbol: string;
  timeframe: string;

  // Technical Indicators
  indicators: {
    [key: string]: {
      type: string;
      period: number;
      source?: 'close' | 'open' | 'high' | 'low' | 'volume';
      settings?: Record<string, any>;
    };
  };

  // Entry Conditions
  entry: {
    long?: ConditionGroup[];
    short?: ConditionGroup[];
  };

  // Exit Conditions
  exit: {
    long?: ExitConditionGroup[];
    short?: ExitConditionGroup[];
  };

  // Risk Management
  risk: {
    stopLoss: number;        // Percentage (0.02 = 2%)
    takeProfit: number;      // Percentage (0.04 = 4%)
    maxPositionSize: number; // Percentage of portfolio (0.1 = 10%)
    maxDrawdown: number;     // Maximum drawdown allowed (0.05 = 5%)
    maxDailyLoss: number;    // Maximum daily loss (0.03 = 3%)
    positionSizing: 'fixed' | 'percentage' | 'kelly' | 'martingale';
    riskRewardRatio?: number; // Minimum risk/reward ratio
  };

  // Strategy Parameters
  params: Record<string, any>;

  // Execution Settings
  execution: {
    orderType: 'market' | 'limit' | 'stop';
    slippage: number;        // Expected slippage (0.001 = 0.1%)
    commission: number;      // Commission rate (0.0004 = 0.04%)
    minTradeValue: number;   // Minimum trade value in base currency
  };

  // Time-based Filters
  filters?: {
    tradingHours?: {
      start: string;  // "09:00"
      end: string;    // "16:00"
      timezone: string; // "UTC"
    };
    weekdays?: number[]; // [1,2,3,4,5] for Mon-Fri
    blackoutPeriods?: {
      start: Date;
      end: Date;
      reason: string;
    }[];
  };
}

// Condition Structures
export interface ConditionGroup {
  operator: 'and' | 'or';
  conditions: Condition[];
}

export interface Condition {
  type: 'indicator' | 'price' | 'volume' | 'pattern' | 'custom';
  indicator?: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'crossover' | 'crossunder' | 'rising' | 'falling';
  value: number | string;
  lookback?: number; // Number of periods to look back
  timeframe?: string; // Different timeframe for multi-timeframe analysis
}

export interface ExitConditionGroup extends ConditionGroup {
  priority: number; // Higher priority conditions are checked first
  exitType: 'profit' | 'loss' | 'signal' | 'time' | 'trailing';
}

// Strategy Execution Context
export interface StrategyExecutionContext {
  strategyId: string;
  accountId: string;
  symbol: string;
  timeframe: string;
  dsl: StrategyDSL;

  // Market Data
  currentCandle: Candle;
  historicalCandles: Candle[];
  currentTicker: Ticker;

  // Portfolio State
  currentPosition: {
    side: 'long' | 'short' | 'none';
    size: number;
    entryPrice: number;
    entryTime: Date;
    unrealizedPnL: number;
  };

  // Calculated Indicators
  indicators: Map<string, number[]>;

  // Strategy State
  state: Record<string, any>;
  signals: StrategySignal[];

  // Risk Metrics
  metrics: {
    currentDrawdown: number;
    dailyPnL: number;
    totalTrades: number;
    winRate: number;
    sharpeRatio: number;
  };
}

// Strategy Signal
export interface StrategySignal {
  type: 'entry' | 'exit' | 'modify' | 'alert';
  direction: 'long' | 'short' | 'close';
  strength: number; // 0-1 confidence level
  reason: string;
  timestamp: Date;

  // Order Details
  orderType: 'market' | 'limit' | 'stop';
  price?: number;
  quantity?: number;
  stopLoss?: number;
  takeProfit?: number;

  // Metadata
  triggeredBy: string; // Which condition triggered this signal
  indicators: Record<string, number>; // Indicator values at signal time
}

// Strategy Executor Interface
export interface StrategyExecutor {
  executeFromDSL(dsl: StrategyDSL, historicalData: Candle[]): Promise<StrategyExecutionResult>;
  processRealtimeData(context: StrategyExecutionContext): Promise<StrategySignal[]>;
  validateDSL(dsl: StrategyDSL): StrategyValidationResult;
  calculateIndicators(dsl: StrategyDSL, candles: Candle[]): Promise<Map<string, number[]>>;
}

// Strategy Execution Result
export interface StrategyExecutionResult {
  strategyId: string;
  success: boolean;

  // Performance Metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  sharpeRatio: number;
  profitFactor: number;

  // Trade Details
  trades: StrategyTrade[];
  signals: StrategySignal[];

  // Equity Curve
  equityCurve: {
    timestamp: Date;
    equity: number;
    drawdown: number;
  }[];

  // Strategy Statistics
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  averageHoldingTime: number; // in milliseconds

  // Risk Metrics
  dailyPnL: { date: string; pnl: number }[];
  monthlyReturns: { month: string; return: number }[];

  // Execution Details
  executionTime: number; // milliseconds
  candlesProcessed: number;
  errorsEncountered: string[];
  warnings: string[];
}

// Strategy Trade
export interface StrategyTrade {
  id: string;
  strategyId: string;
  symbol: string;
  side: 'long' | 'short';

  // Entry
  entryTime: Date;
  entryPrice: number;
  entryReason: string;
  entrySignal: StrategySignal;

  // Exit
  exitTime: Date;
  exitPrice: number;
  exitReason: string;
  exitSignal: StrategySignal;

  // Trade Metrics
  quantity: number;
  pnl: number;
  pnlPercentage: number;
  commission: number;
  slippage: number;
  holdingTime: number; // milliseconds

  // Risk Metrics
  maxFavorableExcursion: number; // Best unrealized profit during trade
  maxAdverseExcursion: number;   // Worst unrealized loss during trade

  // Market Context
  entryCandle: Candle;
  exitCandle: Candle;
  indicators: Record<string, number>;
}

// DSL Validation
export interface StrategyValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
}

// Live Strategy Runner
export interface LiveStrategyRunner {
  startStrategy(strategyId: string, accountId: string): Promise<void>;
  stopStrategy(strategyId: string): Promise<void>;
  pauseStrategy(strategyId: string): Promise<void>;
  resumeStrategy(strategyId: string): Promise<void>;
  getRunningStrategies(): Promise<RunningStrategy[]>;
  getStrategyStatus(strategyId: string): Promise<StrategyStatus>;
}

export interface RunningStrategy {
  strategyId: string;
  accountId: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  startedAt: Date;
  lastExecutedAt: Date;
  nextExecutionAt: Date;
  executionCount: number;

  // Current State
  currentPosition: string | null;
  lastSignal: StrategySignal | null;

  // Performance Summary
  totalTrades: number;
  currentPnL: number;
  currentDrawdown: number;

  // Configuration
  dsl: StrategyDSL;
  riskSettings: Record<string, any>;
}

export interface StrategyStatus {
  isRunning: boolean;
  health: 'healthy' | 'warning' | 'error';
  lastHeartbeat: Date;
  errorMessage?: string;

  // Performance Snapshot
  todayTrades: number;
  todayPnL: number;
  lastSignalTime: Date;

  // System Metrics
  memoryUsage: number;
  cpuUsage: number;
  avgExecutionTime: number;
}

// Technical Indicator Interface
export interface TechnicalIndicator {
  name: string;
  calculate(data: number[], period: number, options?: Record<string, any>): number[];
  validate(period: number, options?: Record<string, any>): boolean;
  getDefaultPeriod(): number;
}

// Indicator Registry
export interface IndicatorRegistry {
  register(name: string, indicator: TechnicalIndicator): void;
  get(name: string): TechnicalIndicator | undefined;
  list(): string[];
}

// Strategy Engine Configuration
export interface StrategyEngineConfig {
  // Execution Settings
  maxConcurrentStrategies: number;
  executionInterval: number; // milliseconds
  maxExecutionTime: number;  // milliseconds per strategy

  // Data Settings
  maxHistoricalCandles: number;
  cacheIndicators: boolean;

  // Risk Management
  globalStopLoss: number;
  maxDailyLossPercentage: number;
  maxPositionSize: number;

  // Performance Monitoring
  enableMetrics: boolean;
  metricsRetentionDays: number;
  alertThresholds: {
    maxDrawdown: number;
    minWinRate: number;
    maxConsecutiveLosses: number;
  };
}

// Strategy Execution Service Interface
export interface StrategyExecutionService {
  // Core Execution
  executeStrategy(context: StrategyExecutionContext): Promise<StrategySignal[]>;
  backtestStrategy(dsl: StrategyDSL, historicalData: Candle[]): Promise<StrategyExecutionResult>;

  // Live Trading
  startLiveStrategy(strategyId: string, accountId: string): Promise<void>;
  stopLiveStrategy(strategyId: string): Promise<void>;

  // DSL Processing
  parseDSL(dslText: string): Promise<StrategyDSL>;
  validateDSL(dsl: StrategyDSL): Promise<StrategyValidationResult>;
  optimizeDSL(dsl: StrategyDSL, historicalData: Candle[]): Promise<StrategyDSL>;

  // Indicators
  calculateIndicators(dsl: StrategyDSL, candles: Candle[]): Promise<Map<string, number[]>>;
  registerIndicator(name: string, indicator: TechnicalIndicator): void;

  // Monitoring
  getRunningStrategies(): Promise<RunningStrategy[]>;
  getStrategyMetrics(strategyId: string): Promise<StrategyStatus>;
  getPerformanceReport(strategyId: string, days: number): Promise<StrategyExecutionResult>;
}

// Event Types for Strategy Engine
export interface StrategyEvent {
  type: 'signal' | 'trade' | 'error' | 'status' | 'performance';
  strategyId: string;
  accountId: string;
  timestamp: Date;
  data: any;
}

export interface StrategySignalEvent extends StrategyEvent {
  type: 'signal';
  data: {
    signal: StrategySignal;
    context: Partial<StrategyExecutionContext>;
  };
}

export interface StrategyTradeEvent extends StrategyEvent {
  type: 'trade';
  data: {
    trade: StrategyTrade;
    signal: PaperTradingSignal;
  };
}

export interface StrategyErrorEvent extends StrategyEvent {
  type: 'error';
  data: {
    error: Error;
    context: string;
    recoverable: boolean;
  };
}

export interface StrategyStatusEvent extends StrategyEvent {
  type: 'status';
  data: {
    status: StrategyStatus;
    previousStatus: string;
  };
}

export interface StrategyPerformanceEvent extends StrategyEvent {
  type: 'performance';
  data: {
    metrics: StrategyExecutionResult;
    dailyUpdate: boolean;
  };
}