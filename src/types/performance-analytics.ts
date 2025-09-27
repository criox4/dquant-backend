/**
 * Performance Analytics Types - Comprehensive Trading Performance Analysis
 * Provides advanced metrics, risk analysis, and strategy performance evaluation
 */

export interface PerformanceMetrics {
  // Return Metrics
  totalReturn: number;
  totalReturnPercentage: number;
  annualizedReturn: number;
  cumulativeReturn: number;

  // Risk Metrics
  sharpeRatio: number;
  sortinRatio: number;
  calmarRatio: number;
  maximumDrawdown: number;
  maximumDrawdownPercentage: number;
  averageDrawdown: number;
  volatility: number;
  valueAtRisk: number; // VaR at 95% confidence
  conditionalValueAtRisk: number; // CVaR

  // Trade Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  lossRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;

  // Time-based Metrics
  averageHoldingTime: number; // in hours
  averageTimeToProfit: number;
  averageTimeToLoss: number;
  tradingFrequency: number; // trades per day

  // Additional Metrics
  expectancy: number;
  kelly: number; // Kelly criterion percentage
  ulcerIndex: number;
  recoveryFactor: number;

  // Period Information
  startDate: Date;
  endDate: Date;
  totalDays: number;
  tradingDays: number;
}

export interface RiskMetrics {
  // Drawdown Analysis
  drawdowns: DrawdownPeriod[];
  currentDrawdown: number;
  currentDrawdownDuration: number;
  maxDrawdownDuration: number;

  // Risk Ratios
  sharpeRatio: number;
  sortinRatio: number;
  calmarRatio: number;
  sterlingRatio: number;
  burkeRatio: number;

  // Volatility Metrics
  volatility: number;
  downwardVolatility: number;
  upwardVolatility: number;
  beta: number; // vs benchmark
  alpha: number; // vs benchmark

  // Value at Risk
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;

  // Risk-adjusted Returns
  treynorRatio: number;
  informationRatio: number;
  trackingError: number;

  // Tail Risk
  skewness: number;
  kurtosis: number;
  tailRatio: number;
}

export interface DrawdownPeriod {
  startDate: Date;
  endDate: Date;
  duration: number; // in days
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  recovery: boolean;
  recoveryDate?: Date;
  recoveryDuration?: number;
}

export interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  accountId: string;

  // Basic Performance
  metrics: PerformanceMetrics;
  riskMetrics: RiskMetrics;

  // Time Series Data
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  monthlyReturns: MonthlyReturn[];
  rollingMetrics: RollingMetrics[];

  // Trade Analysis
  tradeAnalysis: TradeAnalysis;

  // Benchmark Comparison
  benchmarkComparison?: BenchmarkComparison;

  // Strategy-specific Metrics
  signalAccuracy: number;
  signalFrequency: number;
  averageSignalStrength: number;

  // Timestamps
  lastCalculated: Date;
  calculationDuration: number; // in milliseconds
}

export interface EquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
  trades: number;
  returns: number;
}

export interface DrawdownPoint {
  timestamp: Date;
  drawdown: number;
  drawdownPercentage: number;
  isNewHigh: boolean;
  daysSinceHigh: number;
}

export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  returnPercentage: number;
  trades: number;
  winRate: number;
  maxDrawdown: number;
}

export interface RollingMetrics {
  date: Date;
  period: number; // rolling window in days
  returns: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface TradeAnalysis {
  // Trade Distribution
  tradesByProfit: TradeDistribution[];
  tradesByDuration: TradeDistribution[];
  tradesByDay: TradeDistribution[];
  tradesByHour: TradeDistribution[];

  // Win/Loss Streaks
  longestWinStreak: number;
  longestLossStreak: number;
  currentStreak: number;
  currentStreakType: 'win' | 'loss' | 'none';

  // Trade Quality
  averageMAE: number; // Maximum Adverse Excursion
  averageMFE: number; // Maximum Favorable Excursion
  maeToMfeRatio: number;

  // Position Sizing Analysis
  averagePositionSize: number;
  maxPositionSize: number;
  positionSizeEfficiency: number;

  // Symbol Analysis
  performanceBySymbol: SymbolPerformance[];

  // Time Analysis
  performanceByTimeOfDay: TimePerformance[];
  performanceByDayOfWeek: TimePerformance[];
  performanceByMonth: TimePerformance[];
}

export interface TradeDistribution {
  range: string;
  count: number;
  percentage: number;
  totalProfit: number;
  averageProfit: number;
}

export interface SymbolPerformance {
  symbol: string;
  trades: number;
  winRate: number;
  totalProfit: number;
  averageProfit: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
}

export interface TimePerformance {
  period: string;
  trades: number;
  winRate: number;
  averageReturn: number;
  totalReturn: number;
  sharpeRatio: number;
}

export interface BenchmarkComparison {
  benchmarkName: string;
  benchmarkSymbol: string;

  // Relative Performance
  alpha: number;
  beta: number;
  correlationCoefficient: number;
  trackingError: number;
  informationRatio: number;

  // Period Returns Comparison
  strategyReturn: number;
  benchmarkReturn: number;
  excessReturn: number;

  // Risk Comparison
  strategyVolatility: number;
  benchmarkVolatility: number;
  strategySharpe: number;
  benchmarkSharpe: number;

  // Downside Protection
  downCaptureRatio: number;
  upCaptureRatio: number;
  downsideDeviation: number;
}

export interface PortfolioAnalytics {
  accountId: string;

  // Overall Portfolio Performance
  totalMetrics: PerformanceMetrics;
  totalRiskMetrics: RiskMetrics;

  // Strategy Breakdown
  strategyPerformances: StrategyPerformance[];
  strategyCorrelations: StrategyCorrelation[];

  // Portfolio Composition
  portfolioComposition: AssetAllocation[];

  // Risk Analysis
  portfolioVaR: number;
  portfolioCVaR: number;
  concentrationRisk: number;
  diversificationRatio: number;

  // Attribution Analysis
  performanceAttribution: AttributionAnalysis[];

  lastUpdated: Date;
}

export interface StrategyCorrelation {
  strategy1Id: string;
  strategy2Id: string;
  correlation: number;
  rollingCorrelation: number[];
  avgCorrelation: number;
}

export interface AssetAllocation {
  symbol: string;
  allocation: number; // percentage
  value: number;
  returns: number;
  contribution: number; // contribution to total return
}

export interface AttributionAnalysis {
  source: string; // strategy or asset
  contribution: number;
  weight: number;
  return: number;
  selection: number;
  allocation: number;
}

// Analytics Configuration
export interface AnalyticsConfig {
  calculationPeriods: number[]; // rolling window periods in days
  riskFreeRate: number;
  benchmarkSymbol: string;
  confidenceLevels: number[]; // for VaR calculations

  // Calculation Settings
  enableRealTimeCalculation: boolean;
  calculationFrequency: number; // in seconds
  historicalDataDays: number;

  // Alert Thresholds
  maxDrawdownAlert: number;
  sharpeRatioAlert: number;
  winRateAlert: number;

  // Advanced Settings
  enableMonteCarloSimulation: boolean;
  monteCarloIterations: number;
  enableStressTests: boolean;
  stressTestScenarios: string[];
}

// Analytics Service Interfaces
export interface PerformanceAnalyticsService {
  // Core Calculations
  calculatePerformanceMetrics(accountId: string, startDate?: Date, endDate?: Date): Promise<PerformanceMetrics>;
  calculateRiskMetrics(accountId: string, startDate?: Date, endDate?: Date): Promise<RiskMetrics>;
  calculateStrategyPerformance(strategyId: string, accountId: string): Promise<StrategyPerformance>;
  calculatePortfolioAnalytics(accountId: string): Promise<PortfolioAnalytics>;

  // Time Series Analysis
  generateEquityCurve(accountId: string, startDate?: Date, endDate?: Date): Promise<EquityPoint[]>;
  generateDrawdownCurve(accountId: string, startDate?: Date, endDate?: Date): Promise<DrawdownPoint[]>;
  calculateRollingMetrics(accountId: string, period: number): Promise<RollingMetrics[]>;

  // Comparative Analysis
  compareStrategies(strategyIds: string[], accountId: string): Promise<StrategyComparison>;
  compareToBenchmark(accountId: string, benchmarkSymbol: string): Promise<BenchmarkComparison>;

  // Real-time Updates
  startRealTimeAnalytics(accountId: string): Promise<void>;
  stopRealTimeAnalytics(accountId: string): Promise<void>;

  // Reporting
  generatePerformanceReport(accountId: string, format: 'pdf' | 'html' | 'json'): Promise<string>;
  exportAnalytics(accountId: string, format: 'csv' | 'xlsx' | 'json'): Promise<Buffer>;

  // Alerts
  checkPerformanceAlerts(accountId: string): Promise<PerformanceAlert[]>;
  configureAlerts(accountId: string, config: AlertConfiguration): Promise<void>;
}

export interface StrategyComparison {
  strategies: StrategyPerformance[];
  correlationMatrix: number[][];
  rankings: StrategyRanking[];

  // Combined Metrics
  combinedSharpe: number;
  combinedDrawdown: number;
  diversificationBenefit: number;

  // Recommendations
  recommendations: string[];
}

export interface StrategyRanking {
  strategyId: string;
  strategyName: string;
  rank: number;
  score: number;
  metrics: {
    returns: number;
    risk: number;
    consistency: number;
    drawdown: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  timestamp: Date;
  accountId: string;
  strategyId?: string;
}

export interface AlertConfiguration {
  enabled: boolean;
  thresholds: {
    maxDrawdown: number;
    minSharpeRatio: number;
    minWinRate: number;
    maxConsecutiveLosses: number;
    minDailyReturn: number;
    maxDailyLoss: number;
  };
  notifications: {
    email: boolean;
    webhook: boolean;
    websocket: boolean;
  };
}

// Event Types for Real-time Analytics
export interface AnalyticsUpdateEvent {
  type: 'PERFORMANCE_UPDATE' | 'RISK_UPDATE' | 'ALERT_TRIGGERED' | 'CALCULATION_COMPLETE';
  accountId: string;
  strategyId?: string;
  data: any;
  timestamp: Date;
}

export interface PerformanceUpdateEvent extends AnalyticsUpdateEvent {
  type: 'PERFORMANCE_UPDATE';
  data: {
    metrics: Partial<PerformanceMetrics>;
    equityPoint: EquityPoint;
    drawdownPoint: DrawdownPoint;
  };
}

export interface RiskUpdateEvent extends AnalyticsUpdateEvent {
  type: 'RISK_UPDATE';
  data: {
    riskMetrics: Partial<RiskMetrics>;
    alerts: PerformanceAlert[];
  };
}

export interface AlertTriggeredEvent extends AnalyticsUpdateEvent {
  type: 'ALERT_TRIGGERED';
  data: {
    alert: PerformanceAlert;
  };
}

// Mathematical and Statistical Helper Types
export interface StatisticalSummary {
  mean: number;
  median: number;
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  minimum: number;
  maximum: number;
  count: number;
  percentiles: {
    p5: number;
    p25: number;
    p75: number;
    p95: number;
  };
}

export interface MonteCarloResult {
  iterations: number;
  scenarios: MonteCarloScenario[];
  statistics: StatisticalSummary;
  confidenceIntervals: {
    level: number;
    lower: number;
    upper: number;
  }[];
  worstCase: number;
  bestCase: number;
  expectedValue: number;
}

export interface MonteCarloScenario {
  iteration: number;
  finalValue: number;
  maxDrawdown: number;
  path: number[];
}

export interface StressTestResult {
  scenario: string;
  description: string;
  impact: number;
  impactPercentage: number;
  recoveryTime: number; // estimated days to recover
  probability: number; // estimated probability of scenario
}