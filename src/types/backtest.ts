/**
 * Backtesting Types - Historical Strategy Testing and Analysis
 */

export interface BacktestRequest {
  strategyId: string;
  symbol: string;
  timeframe: string;
  startDate: Date | string;
  endDate: Date | string;
  initialCapital: number;
  commission?: number;
  slippage?: number;
  maxPositions?: number;
  riskPerTrade?: number;
  parameters?: Record<string, any>;
}

export interface BacktestConfiguration {
  strategyId: string;
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  commission: number;
  slippage: number;
  maxPositions: number;
  riskPerTrade: number;
  parameters: Record<string, any>;
}

export interface BacktestCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: string;
}

export interface BacktestTrade {
  id: string;
  timestamp: number;
  type: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  price: number;
  commission: number;
  slippage: number;
  reason: string;
  strategySignal?: any;
}

export interface BacktestPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
  exitPrice?: number;
  exitTime?: number;
  quantity: number;
  unrealizedPnL: number;
  realizedPnL?: number;
  commission: number;
  maxDrawdown: number;
  maxProfit: number;
  duration?: number;
  isOpen: boolean;
  trades: BacktestTrade[];
}

export interface BacktestPerformanceMetrics {
  totalReturn: number;
  totalReturnPercentage: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  winRate: number;
  profitLossRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageTradeDuration: number;
  totalCommissions: number;
  totalSlippage: number;
  initialCapital: number;
  finalCapital: number;
  timeframe: string;
  period: {
    start: Date;
    end: Date;
    durationDays: number;
  };
}

export interface BacktestRiskMetrics {
  valueAtRisk: number;
  expectedShortfall: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  downsideDeviation: number;
  recoveryFactor: number;
  payoffRatio: number;
  profitFactor: number;
  kellyPercentage: number;
  informationRatio: number;
  treynorRatio: number;
  beta: number;
  alpha: number;
  correlation: number;
}

export interface BacktestEquityCurve {
  timestamp: number;
  equity: number;
  drawdown: number;
  drawdownPercentage: number;
  returns: number;
  cumulativeReturns: number;
  trades: number;
  positions: number;
}

export interface BacktestMonthlyReturns {
  year: number;
  month: number;
  returns: number;
  trades: number;
  winRate: number;
}

export interface BacktestResult {
  id: string;
  backtestId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  configuration: BacktestConfiguration;
  performance: BacktestPerformanceMetrics;
  riskMetrics: BacktestRiskMetrics;
  equityCurve: BacktestEquityCurve[];
  monthlyReturns: BacktestMonthlyReturns[];
  positions: BacktestPosition[];
  trades: BacktestTrade[];
  errors?: string[];
  warnings?: string[];
  metadata: {
    candlesProcessed: number;
    signalsGenerated: number;
    executionTime: number;
    memoryUsage: number;
    version: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestProgress {
  backtestId: string;
  percentage: number;
  currentCandle: number;
  totalCandles: number;
  currentDate: Date;
  timeRemaining?: number;
  status: string;
  recentTrades: BacktestTrade[];
  currentEquity: number;
  currentDrawdown: number;
}

export interface BacktestStrategy {
  id: string;
  name: string;
  code: string;
  parameters: Record<string, any>;
  initialize?: () => Promise<void>;
  onCandle: (candle: BacktestCandle, context: BacktestContext) => Promise<BacktestSignal[]>;
  onTrade?: (trade: BacktestTrade, context: BacktestContext) => Promise<void>;
  onComplete?: (result: BacktestResult) => Promise<void>;
}

export interface BacktestSignal {
  type: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  symbol: string;
  price?: number;
  quantity?: number;
  percentage?: number;
  reason: string;
  confidence?: number;
  stopLoss?: number;
  takeProfit?: number;
  metadata?: Record<string, any>;
}

export interface BacktestContext {
  equity: number;
  availableCash: number;
  positions: BacktestPosition[];
  openPositions: BacktestPosition[];
  trades: BacktestTrade[];
  currentCandle: BacktestCandle;
  previousCandles: BacktestCandle[];
  indicators: Record<string, any>;
  configuration: BacktestConfiguration;
  progress: {
    candleIndex: number;
    totalCandles: number;
    currentDate: Date;
  };
}

export interface BacktestOptimization {
  id: string;
  strategyId: string;
  parameters: Record<string, any[]>;
  ranges: Record<string, { min: number; max: number; step: number }>;
  objective: 'return' | 'sharpe' | 'drawdown' | 'winRate' | 'profitFactor';
  results: BacktestOptimizationResult[];
  bestResult: BacktestOptimizationResult;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface BacktestOptimizationResult {
  parameters: Record<string, any>;
  performance: BacktestPerformanceMetrics;
  score: number;
  rank: number;
  backtestResult: BacktestResult;
}

export interface BacktestComparison {
  id: string;
  name: string;
  backtests: BacktestResult[];
  comparison: {
    metrics: Record<string, number[]>;
    rankings: Record<string, number[]>;
    correlations: number[][];
    summary: {
      bestReturn: string;
      bestSharpe: string;
      bestDrawdown: string;
      mostConsistent: string;
    };
  };
  createdAt: Date;
}

export interface BacktestPortfolio {
  strategies: {
    strategyId: string;
    allocation: number;
    parameters: Record<string, any>;
  }[];
  rebalanceFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  performance: BacktestPerformanceMetrics;
  correlations: Record<string, number>;
}

// API Request/Response Types
export interface CreateBacktestRequest {
  Body: BacktestRequest;
}

export interface GetBacktestRequest {
  Params: {
    backtestId: string;
  };
}

export interface ListBacktestsRequest {
  Querystring: {
    strategyId?: string;
    symbol?: string;
    status?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'performance' | 'drawdown';
    sortOrder?: 'asc' | 'desc';
  };
}

export interface BacktestResponse {
  success: boolean;
  data: BacktestResult;
  message?: string;
}

export interface BacktestListResponse {
  success: boolean;
  data: {
    backtests: BacktestResult[];
    total: number;
    limit: number;
    offset: number;
  };
  message?: string;
}

export interface BacktestProgressResponse {
  success: boolean;
  data: BacktestProgress;
  message?: string;
}

// Event Types for WebSocket
export interface BacktestEvent {
  type: 'STARTED' | 'PROGRESS' | 'TRADE' | 'COMPLETED' | 'ERROR';
  backtestId: string;
  data: any;
  timestamp: number;
}

export interface BacktestStartedEvent extends BacktestEvent {
  type: 'STARTED';
  data: {
    configuration: BacktestConfiguration;
    estimatedDuration: number;
  };
}

export interface BacktestProgressEvent extends BacktestEvent {
  type: 'PROGRESS';
  data: BacktestProgress;
}

export interface BacktestTradeEvent extends BacktestEvent {
  type: 'TRADE';
  data: {
    trade: BacktestTrade;
    position?: BacktestPosition;
    equity: number;
    drawdown: number;
  };
}

export interface BacktestCompletedEvent extends BacktestEvent {
  type: 'COMPLETED';
  data: BacktestResult;
}

export interface BacktestErrorEvent extends BacktestEvent {
  type: 'ERROR';
  data: {
    error: string;
    details?: any;
  };
}

// Utility Types
export type BacktestStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface BacktestStatistics {
  totalBacktests: number;
  runningBacktests: number;
  completedBacktests: number;
  failedBacktests: number;
  averageExecutionTime: number;
  averagePerformance: BacktestPerformanceMetrics;
  topPerformers: BacktestResult[];
}

export interface BacktestEngine {
  runBacktest(config: BacktestConfiguration): Promise<BacktestResult>;
  getBacktest(backtestId: string): Promise<BacktestResult | null>;
  cancelBacktest(backtestId: string): Promise<boolean>;
  optimizeStrategy(optimization: BacktestOptimization): Promise<BacktestOptimizationResult[]>;
  compareBacktests(backtestIds: string[]): Promise<BacktestComparison>;
  getStatistics(): Promise<BacktestStatistics>;
}