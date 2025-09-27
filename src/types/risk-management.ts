/**
 * Risk Management Type Definitions
 * Comprehensive risk management types for trading operations
 */

// Removed unused Decimal import

// Risk Configuration Types
export interface RiskProfile {
  id: string;
  name: string;
  maxAccountRisk: number;           // Max % of account per trade
  maxPositionSize: number;          // Max position size per trade
  maxDailyLoss: number;            // Max daily loss in $ or %
  maxDrawdown: number;             // Max portfolio drawdown %
  maxLeverage: number;             // Max leverage multiplier
  stopLossRequired: boolean;       // Force stop loss on all trades
  takeProfitRequired: boolean;     // Force take profit on all trades
  maxOpenPositions: number;        // Max concurrent positions
  sectorConcentrationLimit: number; // Max % in one sector
  correlationLimit: number;        // Max correlation between positions
  volatilityLimit: number;         // Max position volatility
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Position Sizing Models
export enum PositionSizingModel {
  FIXED_AMOUNT = 'fixed_amount',
  FIXED_PERCENTAGE = 'fixed_percentage',
  KELLY_CRITERION = 'kelly_criterion',
  OPTIMAL_F = 'optimal_f',
  VOLATILITY_ADJUSTED = 'volatility_adjusted',
  RISK_PARITY = 'risk_parity',
  VAR_BASED = 'var_based'
}

export interface PositionSizingConfig {
  model: PositionSizingModel;
  fixedAmount?: number;
  fixedPercentage?: number;
  kellyFraction?: number;           // Kelly criterion fraction (0-1)
  volatilityTarget?: number;        // Target volatility %
  lookbackPeriod?: number;          // Days for volatility calculation
  maxPosition?: number;             // Max position size override
  minPosition?: number;             // Min position size
}

// Risk Metrics
export interface RiskMetrics {
  accountId: string;
  timestamp: Date;

  // Portfolio Risk
  totalExposure: number;
  netExposure: number;
  grossExposure: number;
  leverage: number;

  // Drawdown Metrics
  currentDrawdown: number;
  maxDrawdown: number;
  drawdownDuration: number;         // Days in drawdown

  // Volatility Metrics
  portfolioVolatility: number;      // Annualized %
  var95: number;                    // 95% Value at Risk
  cvar95: number;                   // 95% Conditional VaR
  expectedShortfall: number;

  // Concentration Risk
  maxSectorExposure: number;
  maxPositionExposure: number;
  correlationRisk: number;

  // Performance Risk
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxConsecutiveLosses: number;

  // Liquidity Risk
  avgDailyVolume: number;
  marketImpact: number;
  bidAskSpread: number;
}

// Risk Rules and Violations
export enum RiskRuleType {
  POSITION_SIZE = 'position_size',
  STOP_LOSS = 'stop_loss',
  TAKE_PROFIT = 'take_profit',
  MAX_DRAWDOWN = 'max_drawdown',
  DAILY_LOSS = 'daily_loss',
  LEVERAGE = 'leverage',
  CONCENTRATION = 'concentration',
  CORRELATION = 'correlation',
  VOLATILITY = 'volatility',
  LIQUIDITY = 'liquidity'
}

export enum RiskSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RiskRule {
  id: string;
  type: RiskRuleType;
  severity: RiskSeverity;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  message: string;
  action: 'warn' | 'block' | 'close_positions' | 'reduce_size';
  isActive: boolean;
}

export interface RiskViolation {
  id: string;
  accountId: string;
  ruleId: string;
  type: RiskRuleType;
  severity: RiskSeverity;
  currentValue: number;
  threshold: number;
  message: string;
  action: string;
  isResolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

// Pre-trade Risk Checks
export interface PreTradeRiskCheck {
  accountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  orderType: string;

  // Risk Assessment Results
  isApproved: boolean;
  violations: RiskViolation[];
  warnings: string[];
  adjustedQuantity?: number;        // Risk-adjusted position size
  maxAllowedQuantity: number;
  requiredStopLoss?: number;
  requiredTakeProfit?: number;

  // Risk Calculations
  positionValue: number;
  accountRisk: number;              // % of account at risk
  portfolioImpact: number;          // Impact on portfolio risk
  correlationImpact: number;        // Correlation with existing positions
  liquidityScore: number;           // Liquidity assessment (0-100)

  timestamp: Date;
}

// Position Risk Monitoring
export interface PositionRisk {
  positionId: string;
  accountId: string;
  symbol: string;

  // Current Risk Status
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  currentRisk: number;              // Current $ at risk
  maxRisk: number;                  // Max acceptable risk

  // Stop Loss Management
  stopLossPrice?: number;
  stopLossDistance: number;         // Distance to stop loss
  trailingStop?: number;
  dynamicStopLoss?: number;         // AI-calculated optimal stop

  // Take Profit Management
  takeProfitPrice?: number;
  takeProfitDistance: number;
  partialTakeProfits: number[];     // Multiple TP levels

  // Time-based Risk
  timeInPosition: number;           // Hours in position
  maxTimeLimit?: number;            // Max time in position

  // Market Risk
  impliedVolatility?: number;
  deltaRisk?: number;               // Options delta
  gammaRisk?: number;               // Options gamma
  vegaRisk?: number;                // Options vega
  thetaRisk?: number;               // Options theta

  lastUpdated: Date;
}

// Risk Report Types
export interface RiskReport {
  accountId: string;
  reportDate: Date;

  // Summary
  overallRiskScore: number;         // 0-100 risk score
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';

  // Risk Breakdown
  portfolioRisk: RiskMetrics;
  positionRisks: PositionRisk[];
  activeViolations: RiskViolation[];

  // Recommendations
  recommendations: RiskRecommendation[];

  // Historical Context
  riskTrend: 'improving' | 'stable' | 'deteriorating';
  periodComparison: {
    metric: string;
    current: number;
    previous: number;
    change: number;
    changePercent: number;
  }[];
}

export interface RiskRecommendation {
  type: 'reduce_position' | 'add_stop_loss' | 'hedge_position' | 'close_position' | 'reduce_leverage';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  symbol?: string;
  action: string;
  rationale: string;
  expectedImpact: string;
  timeframe: string;
}

// Risk Engine Configuration
export interface RiskEngineConfig {
  enablePreTradeChecks: boolean;
  enableRealTimeMonitoring: boolean;
  enableAutoStopLoss: boolean;
  enableDynamicSizing: boolean;

  // Check Frequencies
  portfolioCheckInterval: number;   // Minutes
  positionCheckInterval: number;    // Minutes
  violationCheckInterval: number;   // Minutes

  // Notification Settings
  emailAlerts: boolean;
  webhookAlerts: boolean;
  inAppNotifications: boolean;

  // Data Sources
  marketDataProvider: string;
  fundamentalDataProvider?: string;
  optionsDataProvider?: string;
}

// Risk Manager Interface
export interface IRiskManager {
  // Configuration
  loadRiskProfile(accountId: string): Promise<RiskProfile>;
  updateRiskProfile(accountId: string, profile: Partial<RiskProfile>): Promise<RiskProfile>;

  // Pre-trade Risk
  checkPreTradeRisk(trade: PreTradeRiskCheck): Promise<PreTradeRiskCheck>;
  calculatePositionSize(accountId: string, symbol: string, riskAmount: number): Promise<number>;

  // Portfolio Risk
  calculatePortfolioRisk(accountId: string): Promise<RiskMetrics>;
  monitorPositionRisk(positionId: string): Promise<PositionRisk>;

  // Risk Rules
  validateRiskRules(accountId: string): Promise<RiskViolation[]>;
  addRiskRule(accountId: string, rule: Omit<RiskRule, 'id'>): Promise<RiskRule>;
  updateRiskRule(ruleId: string, updates: Partial<RiskRule>): Promise<RiskRule>;

  // Reporting
  generateRiskReport(accountId: string): Promise<RiskReport>;
  getRiskHistory(accountId: string, days: number): Promise<RiskMetrics[]>;

  // Real-time Monitoring
  startMonitoring(accountId: string): Promise<void>;
  stopMonitoring(accountId: string): Promise<void>;

  // Emergency Actions
  emergencyStopLoss(accountId: string): Promise<void>;
  reducePositions(accountId: string, percentage: number): Promise<void>;
  liquidateAccount(accountId: string): Promise<void>;
}

// Events
export interface RiskEvent {
  id: string;
  accountId: string;
  type: 'violation' | 'warning' | 'emergency' | 'position_closed';
  severity: RiskSeverity;
  message: string;
  data: any;
  timestamp: Date;
}

// Types are already exported with their definitions above

