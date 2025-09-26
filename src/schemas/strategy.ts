import { z } from 'zod';

// DSL Schema Definitions
export const dslOperatorSchema = z.enum([
  '>', '<', '>=', '<=', '==', '!=',
  'crosses_above', 'crosses_below',
  'touches', 'breaks_above', 'breaks_below'
]);

export const dslIndicatorSchema = z.object({
  name: z.string().min(1, 'Indicator name is required'),
  alias: z.string().min(1, 'Indicator alias is required'),
  params: z.record(z.any()).optional().default({})
});

export const dslConditionSchema = z.object({
  left: z.string().min(1, 'Left operand is required'),
  op: dslOperatorSchema,
  right: z.union([z.string(), z.number()]).refine(val => val !== null && val !== undefined, {
    message: 'Right operand is required'
  })
});

export const dslRiskManagementSchema = z.object({
  stop_loss: z.number().min(0).max(1, 'Stop loss must be between 0 and 1'),
  take_profit: z.number().min(0, 'Take profit must be positive'),
  position_size: z.number().min(0).max(1).optional(),
  max_drawdown: z.number().min(0).max(1).optional()
});

export const dslParametersSchema = z.object({
  initial_cash: z.number().min(100, 'Initial cash must be at least 100'),
  fee: z.number().min(0).max(0.1, 'Fee must be between 0 and 0.1'),
  slippage: z.number().min(0).max(0.1).optional().default(0.001),
  commission: z.number().min(0).max(0.1).optional().default(0)
});

export const dslStrategySchema = z.object({
  strategy_name: z.string().min(1, 'Strategy name is required').max(100, 'Strategy name too long'),
  symbol: z.string().regex(/^[A-Z]+\/[A-Z]+$/, 'Symbol must be in ASSET/USDT format'),
  timeframe: z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'], {
    errorMap: () => ({ message: 'Invalid timeframe' })
  }),
  indicators: z.array(dslIndicatorSchema).min(1, 'At least one indicator is required'),
  entry: z.array(dslConditionSchema).min(1, 'At least one entry condition is required'),
  exit: z.array(dslConditionSchema).min(1, 'At least one exit condition is required'),
  risk: dslRiskManagementSchema,
  params: dslParametersSchema
});

// Strategy Schema Definitions
export const strategyStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'ERROR']);

export const strategyMetadataSchema = z.object({
  createdBy: z.enum(['AI', 'USER', 'TEMPLATE']),
  aiModel: z.string().optional(),
  backtestCount: z.number().int().min(0).default(0),
  liveTradeCount: z.number().int().min(0).default(0),
  lastBacktestAt: z.date().optional(),
  lastModifiedAt: z.date(),
  complexity: z.enum(['SIMPLE', 'INTERMEDIATE', 'ADVANCED']),
  marketConditions: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([])
});

export const strategyPerformanceMetricsSchema = z.object({
  totalReturn: z.number(),
  annualizedReturn: z.number(),
  sharpeRatio: z.number(),
  maxDrawdown: z.number().min(0).max(1),
  winRate: z.number().min(0).max(1),
  profitFactor: z.number().min(0),
  totalTrades: z.number().int().min(0),
  avgTradeDuration: z.number().min(0),
  bestTrade: z.number(),
  worstTrade: z.number(),
  consecutiveWins: z.number().int().min(0),
  consecutiveLosses: z.number().int().min(0)
});

export const strategyRiskMetricsSchema = z.object({
  volatility: z.number().min(0),
  beta: z.number(),
  var95: z.number(),
  calmarRatio: z.number(),
  sortinoRatio: z.number(),
  maxConsecutiveLosses: z.number().int().min(0),
  avgDrawdownDuration: z.number().min(0)
});

export const strategyDataSchema = z.object({
  strategyId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1, 'Strategy name is required').max(200, 'Strategy name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  status: strategyStatusSchema,
  dsl: dslStrategySchema,
  generatedCode: z.string().optional(),
  version: z.number().int().min(1).default(1),
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false),
  performanceMetrics: strategyPerformanceMetricsSchema.optional(),
  riskMetrics: strategyRiskMetricsSchema.optional(),
  metadata: strategyMetadataSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

// Request/Response Schemas
export const createStrategyRequestSchema = z.object({
  name: z.string().min(1, 'Strategy name is required').max(200, 'Strategy name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  dsl: dslStrategySchema.optional(),
  naturalLanguage: z.string().max(2000, 'Natural language description too long').optional(),
  tags: z.array(z.string()).max(20, 'Too many tags').default([]),
  isTemplate: z.boolean().default(false),
  parentStrategyId: z.string().uuid().optional()
}).refine(data => data.dsl || data.naturalLanguage, {
  message: 'Either DSL or natural language description must be provided'
});

export const updateStrategyRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: strategyStatusSchema.optional(),
  dsl: dslStrategySchema.optional(),
  tags: z.array(z.string()).max(20).optional()
});

export const strategySearchRequestSchema = z.object({
  userId: z.string().uuid().optional(),
  query: z.string().max(200).optional(),
  symbols: z.array(z.string()).max(50).optional(),
  timeframes: z.array(z.string()).max(10).optional(),
  statuses: z.array(strategyStatusSchema).max(5).optional(),
  tags: z.array(z.string()).max(20).optional(),
  categories: z.array(z.string()).max(10).optional(),
  minPerformance: z.number().min(-1).max(10).optional(),
  maxDrawdown: z.number().min(0).max(1).optional(),
  sortBy: z.enum(['PERFORMANCE', 'CREATED_AT', 'NAME', 'TRADES']).default('CREATED_AT'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

// Backtest Schemas
export const backtestTradeSchema = z.object({
  tradeId: z.string().uuid(),
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive(),
  entryTime: z.date(),
  exitTime: z.date(),
  pnl: z.number(),
  pnlPercent: z.number(),
  commission: z.number().min(0),
  slippage: z.number().min(0),
  exitReason: z.enum(['TAKE_PROFIT', 'STOP_LOSS', 'EXIT_SIGNAL', 'TIME_EXIT']),
  holdingPeriod: z.number().min(0)
});

export const backtestEquityPointSchema = z.object({
  timestamp: z.date(),
  equity: z.number(),
  drawdown: z.number().min(0),
  position: z.number(),
  cash: z.number()
});

export const backtestMetadataSchema = z.object({
  dataPoints: z.number().int().min(0),
  executionTime: z.number().min(0),
  memoryUsage: z.number().min(0),
  apiCalls: z.number().int().min(0),
  indicators: z.array(z.string()),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([])
});

export const backtestResultSchema = z.object({
  backtestId: z.string().uuid(),
  strategyId: z.string().uuid(),
  userId: z.string().uuid(),
  symbol: z.string(),
  timeframe: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  initialCapital: z.number().positive(),
  finalCapital: z.number(),
  totalReturn: z.number(),
  totalTrades: z.number().int().min(0),
  winningTrades: z.number().int().min(0),
  losingTrades: z.number().int().min(0),
  profitFactor: z.number().min(0),
  sharpeRatio: z.number(),
  maxDrawdown: z.number().min(0).max(1),
  maxDrawdownDate: z.date(),
  trades: z.array(backtestTradeSchema),
  equity: z.array(backtestEquityPointSchema),
  performance: strategyPerformanceMetricsSchema,
  risk: strategyRiskMetricsSchema,
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  progress: z.number().min(0).max(1),
  duration: z.number().min(0),
  error: z.string().optional(),
  metadata: backtestMetadataSchema,
  createdAt: z.date(),
  updatedAt: z.date()
});

// Optimization Schemas
export const optimizationParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['INTEGER', 'FLOAT', 'BOOLEAN', 'CHOICE']),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  step: z.number().positive().optional(),
  choices: z.array(z.any()).optional(),
  currentValue: z.any()
});

export const optimizationConstraintSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['>', '<', '>=', '<=']),
  value: z.number()
});

export const strategyOptimizationRequestSchema = z.object({
  strategyId: z.string().uuid(),
  parameters: z.array(optimizationParameterSchema).min(1, 'At least one parameter required'),
  objective: z.enum(['MAXIMIZE_RETURN', 'MAXIMIZE_SHARPE', 'MINIMIZE_DRAWDOWN', 'MAXIMIZE_PROFIT_FACTOR']),
  constraints: z.array(optimizationConstraintSchema).default([]),
  backtestPeriod: z.object({
    startDate: z.date(),
    endDate: z.date()
  }),
  maxIterations: z.number().int().min(1).max(10000).default(100)
});

// Validation schemas for specific indicators
export const supportedIndicators = [
  'SMA', 'EMA', 'RSI', 'MACD', 'BB', 'STOCH', 'ATR', 'ADX',
  'OBV', 'VWAP', 'WR', 'CCI', 'MFI', 'KDJ', 'DMI', 'SAR',
  'ICHIMOKU', 'VOLUME'
] as const;

export const indicatorParamsSchema = z.record(z.any()).superRefine((params, ctx) => {
  // Add specific validation for each indicator type
  // This would be expanded based on the specific requirements of each indicator
  return params;
});

// DSL Validation Result Schema
export const dslValidationErrorSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
  severity: z.enum(['ERROR', 'WARNING']),
  suggestions: z.array(z.string()).optional()
});

export const dslValidationWarningSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH'])
});

export const dslSuggestionSchema = z.object({
  type: z.enum(['OPTIMIZATION', 'BEST_PRACTICE', 'ALTERNATIVE']),
  message: z.string(),
  field: z.string().optional(),
  example: z.any().optional()
});

export const dslValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(dslValidationErrorSchema),
  warnings: z.array(dslValidationWarningSchema),
  suggestions: z.array(dslSuggestionSchema),
  estimatedComplexity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  estimatedPerformance: z.enum(['POOR', 'AVERAGE', 'GOOD', 'EXCELLENT'])
});

// Export types derived from schemas
export type CreateStrategyRequest = z.infer<typeof createStrategyRequestSchema>;
export type UpdateStrategyRequest = z.infer<typeof updateStrategyRequestSchema>;
export type StrategySearchRequest = z.infer<typeof strategySearchRequestSchema>;
export type DSLStrategy = z.infer<typeof dslStrategySchema>;
export type DSLIndicator = z.infer<typeof dslIndicatorSchema>;
export type DSLCondition = z.infer<typeof dslConditionSchema>;
export type DSLRiskManagement = z.infer<typeof dslRiskManagementSchema>;
export type DSLParameters = z.infer<typeof dslParametersSchema>;
export type StrategyOptimizationRequest = z.infer<typeof strategyOptimizationRequestSchema>;
export type DSLValidationResult = z.infer<typeof dslValidationResultSchema>;