export interface StrategyData {
  strategyId: string;
  userId: string;
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  status: StrategyStatus;
  dsl: DSLStrategy;
  generatedCode?: string;
  version: number;
  tags: string[];
  isTemplate: boolean;
  performanceMetrics?: StrategyPerformanceMetrics;
  riskMetrics?: StrategyRiskMetrics;
  metadata: StrategyMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export type StrategyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'ERROR';

export interface DSLStrategy {
  strategy_name: string;
  symbol: string;
  timeframe: string;
  indicators: DSLIndicator[];
  entry: DSLCondition[];
  exit: DSLCondition[];
  risk: DSLRiskManagement;
  params: DSLParameters;
}

export interface DSLIndicator {
  name: string;
  alias: string;
  params: Record<string, any>;
}

export interface DSLCondition {
  left: string;
  op: DSLOperator;
  right: string | number;
}

export type DSLOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'crosses_above' | 'crosses_below' | 'touches' | 'breaks_above' | 'breaks_below';

export interface DSLRiskManagement {
  stop_loss: number;
  take_profit: number;
  position_size?: number;
  max_drawdown?: number;
}

export interface DSLParameters {
  initial_cash: number;
  fee: number;
  slippage?: number;
  commission?: number;
}

export interface StrategyPerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  avgTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface StrategyRiskMetrics {
  volatility: number;
  beta: number;
  var95: number; // Value at Risk 95%
  calmarRatio: number;
  sortinoRatio: number;
  maxConsecutiveLosses: number;
  avgDrawdownDuration: number;
}

export interface StrategyMetadata {
  createdBy: 'AI' | 'USER' | 'TEMPLATE';
  aiModel?: string;
  backtestCount: number;
  liveTradeCount: number;
  lastBacktestAt?: Date;
  lastModifiedAt: Date;
  complexity: 'SIMPLE' | 'INTERMEDIATE' | 'ADVANCED';
  marketConditions: string[];
  categories: string[];
}

export interface BacktestResult {
  backtestId: string;
  strategyId: string;
  userId: string;
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownDate: Date;
  trades: BacktestTrade[];
  equity: BacktestEquityPoint[];
  performance: StrategyPerformanceMetrics;
  risk: StrategyRiskMetrics;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  duration: number; // in milliseconds
  error?: string;
  metadata: BacktestMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestTrade {
  tradeId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  pnl: number;
  pnlPercent: number;
  commission: number;
  slippage: number;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'EXIT_SIGNAL' | 'TIME_EXIT';
  holdingPeriod: number; // in minutes
}

export interface BacktestEquityPoint {
  timestamp: Date;
  equity: number;
  drawdown: number;
  position: number;
  cash: number;
}

export interface BacktestMetadata {
  dataPoints: number;
  executionTime: number;
  memoryUsage: number;
  apiCalls: number;
  indicators: string[];
  errors: string[];
  warnings: string[];
}

export interface StrategyTemplate {
  templateId: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  dsl: DSLStrategy;
  tags: string[];
  popularity: number;
  avgPerformance: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface StrategyOptimizationRequest {
  strategyId: string;
  parameters: OptimizationParameter[];
  objective: 'MAXIMIZE_RETURN' | 'MAXIMIZE_SHARPE' | 'MINIMIZE_DRAWDOWN' | 'MAXIMIZE_PROFIT_FACTOR';
  constraints: OptimizationConstraint[];
  backtestPeriod: {
    startDate: Date;
    endDate: Date;
  };
  maxIterations: number;
}

export interface OptimizationParameter {
  name: string;
  type: 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'CHOICE';
  minValue?: number;
  maxValue?: number;
  step?: number;
  choices?: any[];
  currentValue: any;
}

export interface OptimizationConstraint {
  metric: string;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
}

export interface StrategyOptimizationResult {
  optimizationId: string;
  strategyId: string;
  bestParameters: Record<string, any>;
  bestPerformance: StrategyPerformanceMetrics;
  optimizationHistory: OptimizationIteration[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  error?: string;
}

export interface OptimizationIteration {
  iteration: number;
  parameters: Record<string, any>;
  performance: StrategyPerformanceMetrics;
  objective: number;
  timestamp: Date;
}

export interface StrategyComparisonResult {
  strategies: StrategyData[];
  comparisonMetrics: ComparisonMetric[];
  rankings: StrategyRanking[];
  correlation: number[][];
  bestStrategy: string;
  recommendations: string[];
}

export interface ComparisonMetric {
  name: string;
  values: Record<string, number>;
  ranking: Record<string, number>;
}

export interface StrategyRanking {
  strategyId: string;
  rank: number;
  score: number;
  strengths: string[];
  weaknesses: string[];
}

export interface DSLValidationResult {
  isValid: boolean;
  errors: DSLValidationError[];
  warnings: DSLValidationWarning[];
  suggestions: DSLSuggestion[];
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedPerformance: 'POOR' | 'AVERAGE' | 'GOOD' | 'EXCELLENT';
}

export interface DSLValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  suggestions?: string[];
}

export interface DSLValidationWarning {
  field: string;
  code: string;
  message: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DSLSuggestion {
  type: 'OPTIMIZATION' | 'BEST_PRACTICE' | 'ALTERNATIVE';
  message: string;
  field?: string;
  example?: any;
}

export interface StrategyExecutionContext {
  strategyId: string;
  symbol: string;
  timeframe: string;
  mode: 'BACKTEST' | 'PAPER' | 'LIVE';
  startTime: Date;
  endTime?: Date;
  initialCapital: number;
  currentCapital: number;
  position: number;
  openTrades: Trade[];
  closedTrades: Trade[];
  indicators: Record<string, any>;
  lastCandle: CandleData;
  performance: StrategyPerformanceMetrics;
  risk: StrategyRiskMetrics;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
}

export interface Trade {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryTime: Date;
  exitTime?: Date;
  stopLoss?: number;
  takeProfit?: number;
  currentPnl: number;
  maxPnl: number;
  minPnl: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  exitReason?: string;
}

export interface CandleData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: string;
}

export interface StrategySignal {
  signalId: string;
  strategyId: string;
  symbol: string;
  type: 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT_LONG' | 'EXIT_SHORT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  strength: number; // 0-1
  price: number;
  quantity: number;
  timestamp: Date;
  conditions: string[];
  confidence: number;
  metadata: Record<string, any>;
}

export interface StrategyManagerConfig {
  maxActiveStrategies: number;
  defaultInitialCapital: number;
  maxBacktestDuration: number; // in minutes
  enableOptimization: boolean;
  enableLiveTrading: boolean;
  riskLimits: {
    maxDrawdown: number;
    maxDailyLoss: number;
    maxPositionSize: number;
  };
}

export interface CreateStrategyRequest {
  name: string;
  description?: string;
  symbol: string;
  timeframe: string;
  dsl?: DSLStrategy;
  naturalLanguage?: string;
  tags?: string[];
  isTemplate?: boolean;
  parentStrategyId?: string; // for cloning
}

export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  status?: StrategyStatus;
  dsl?: DSLStrategy;
  tags?: string[];
}

export interface StrategySearchRequest {
  userId?: string;
  query?: string;
  symbols?: string[];
  timeframes?: string[];
  statuses?: StrategyStatus[];
  tags?: string[];
  categories?: string[];
  minPerformance?: number;
  maxDrawdown?: number;
  sortBy?: 'PERFORMANCE' | 'CREATED_AT' | 'NAME' | 'TRADES';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface StrategyStats {
  totalStrategies: number;
  activeStrategies: number;
  avgPerformance: number;
  avgDrawdown: number;
  totalBacktests: number;
  strategiesByStatus: Record<StrategyStatus, number>;
  strategiesByTimeframe: Record<string, number>;
  strategiesBySymbol: Record<string, number>;
  topPerformingStrategies: StrategyData[];
  recentStrategies: StrategyData[];
}

// Event types for WebSocket streaming
export interface StrategyEvent {
  event: 'strategy_created' | 'strategy_updated' | 'strategy_deleted' | 'backtest_started' | 'backtest_progress' | 'backtest_completed' | 'optimization_started' | 'optimization_progress' | 'optimization_completed' | 'trade_signal' | 'trade_executed';
  strategyId: string;
  data: any;
  timestamp: string;
}

// Response types for API endpoints
export interface ProcessMessageResponse {
  message: string;
  strategyId?: string;
  action: 'STRATEGY_CREATED' | 'STRATEGY_UPDATED' | 'BACKTEST_STARTED' | 'OPTIMIZATION_STARTED' | 'GENERAL_RESPONSE';
  data?: any;
  metadata?: {
    processingTime?: number;
    aiModel?: string;
    confidence?: number;
    [key: string]: any;
  };
}