/**
 * Paper Trading Types - Virtual Trading System with Realistic Execution
 */

export interface PaperTradingAccount {
  id: string;
  userId: string;
  name: string;
  initialBalance: number;
  currentBalance: number;
  availableBalance: number;
  totalEquity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  marginUsed: number;
  marginAvailable: number;
  marginLevel: number;
  currency: string;
  leverage: number;
  maxLeverage: number;
  isActive: boolean;
  riskSettings: PaperRiskSettings;
  statistics: PaperAccountStatistics;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaperRiskSettings {
  maxDailyLoss: number;
  maxDailyLossPercentage: number;
  maxPositionSize: number;
  maxPositionSizePercentage: number;
  maxOpenPositions: number;
  allowedSymbols: string[];
  blockedSymbols: string[];
  maxLeverage: number;
  stopLossRequired: boolean;
  takeProfitRequired: boolean;
  riskPerTrade: number;
  dailyTradingLimit: number;
  isEnabled: boolean;
}

export interface PaperAccountStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  averageHoldingTime: number;
  totalCommissions: number;
  totalVolume: number;
  activeStrategies: number;
  tradingDays: number;
  lastTradeAt?: Date;
}

export interface PaperPosition {
  id: string;
  accountId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  markPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  margin: number;
  leverage: number;
  liquidationPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  entryTime: Date;
  lastUpdateTime: Date;
  status: 'OPEN' | 'CLOSING' | 'CLOSED';
  strategyId?: string;
  strategyName?: string;
  orders: PaperOrder[];
  trades: PaperTrade[];
  metadata: Record<string, any>;
}

export interface PaperOrder {
  id: string;
  accountId: string;
  positionId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  quantity: number;
  price?: number;
  stopPrice?: number;
  averagePrice?: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  clientOrderId?: string;
  reduceOnly: boolean;
  closePosition: boolean;
  commission: number;
  commissionAsset: string;
  slippage: number;
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  canceledAt?: Date;
  rejectedReason?: string;
  strategyId?: string;
  strategyName?: string;
  executionReport?: PaperExecutionReport;
}

export interface PaperTrade {
  id: string;
  accountId: string;
  orderId: string;
  positionId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commission: number;
  commissionAsset: string;
  realizedPnL: number;
  quoteQuantity: number;
  timestamp: Date;
  isMaker: boolean;
  strategyId?: string;
  strategyName?: string;
  metadata: Record<string, any>;
}

export interface PaperExecutionReport {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  timeInForce: string;
  quantity: number;
  price: number;
  stopPrice?: number;
  executionType: 'NEW' | 'CANCELED' | 'REPLACED' | 'REJECTED' | 'TRADE' | 'EXPIRED';
  orderStatus: string;
  filledQuantity: number;
  filledPrice: number;
  commission: number;
  commissionAsset: string;
  timestamp: Date;
  rejectReason?: string;
}

export interface PaperPortfolio {
  accountId: string;
  totalValue: number;
  totalEquity: number;
  availableBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  marginUsed: number;
  marginLevel: number;
  positions: PaperPosition[];
  openOrders: PaperOrder[];
  dailyPnL: number;
  dailyPnLPercentage: number;
  lastUpdateTime: Date;
}

export interface PaperTradingStrategy {
  id: string;
  accountId: string;
  strategyId: string;
  name: string;
  isActive: boolean;
  symbols: string[];
  maxPositions: number;
  positionSize: number;
  positionSizeType: 'FIXED' | 'PERCENTAGE' | 'RISK_BASED';
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  riskPerTrade: number;
  configuration: Record<string, any>;
  performance: StrategyPerformance;
  lastSignalTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercentage: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  sharpeRatio: number;
  activeSince: Date;
  lastTradeAt?: Date;
}

export interface PaperTradingSignal {
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'CLOSE' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  type: 'MARKET' | 'LIMIT';
  quantity?: number;
  price?: number;
  percentage?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  reason: string;
  confidence: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaperMarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
  changePercent24h: number;
  timestamp: Date;
}

// Request/Response Types for API
export interface CreatePaperAccountRequest {
  Body: {
    name: string;
    initialBalance: number;
    currency?: string;
    leverage?: number;
    riskSettings?: Partial<PaperRiskSettings>;
  };
}

export interface UpdatePaperAccountRequest {
  Params: {
    accountId: string;
  };
  Body: {
    name?: string;
    riskSettings?: Partial<PaperRiskSettings>;
    isActive?: boolean;
  };
}

export interface CreatePaperOrderRequest {
  Params: {
    accountId: string;
  };
  Body: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'GTC' | 'IOC' | 'FOK';
    reduceOnly?: boolean;
    closePosition?: boolean;
    clientOrderId?: string;
    strategyId?: string;
  };
}

export interface CancelPaperOrderRequest {
  Params: {
    accountId: string;
    orderId: string;
  };
}

export interface GetPaperPositionsRequest {
  Params: {
    accountId: string;
  };
  Querystring: {
    symbol?: string;
    status?: 'OPEN' | 'CLOSED';
    strategyId?: string;
    limit?: number;
    offset?: number;
  };
}

export interface GetPaperTradesRequest {
  Params: {
    accountId: string;
  };
  Querystring: {
    symbol?: string;
    strategyId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
  };
}

export interface PaperAccountResponse {
  success: boolean;
  data: PaperTradingAccount;
  message?: string;
}

export interface PaperAccountListResponse {
  success: boolean;
  data: {
    accounts: PaperTradingAccount[];
    total: number;
    limit: number;
    offset: number;
  };
  message?: string;
}

export interface PaperOrderResponse {
  success: boolean;
  data: PaperOrder;
  message?: string;
}

export interface PaperPortfolioResponse {
  success: boolean;
  data: PaperPortfolio;
  message?: string;
}

export interface PaperPositionsResponse {
  success: boolean;
  data: {
    positions: PaperPosition[];
    total: number;
    unrealizedPnL: number;
    totalMargin: number;
  };
  message?: string;
}

export interface PaperTradesResponse {
  success: boolean;
  data: {
    trades: PaperTrade[];
    total: number;
    totalVolume: number;
    totalCommission: number;
  };
  message?: string;
}

export interface PaperPerformanceResponse {
  success: boolean;
  data: {
    account: PaperAccountStatistics;
    strategies: StrategyPerformance[];
    dailyPnL: Array<{
      date: string;
      pnl: number;
      percentage: number;
      trades: number;
    }>;
    equityCurve: Array<{
      timestamp: Date;
      equity: number;
      drawdown: number;
    }>;
  };
  message?: string;
}

// WebSocket Event Types
export interface PaperTradingEvent {
  type: 'ACCOUNT_UPDATE' | 'ORDER_UPDATE' | 'POSITION_UPDATE' | 'TRADE_EXECUTION' | 'BALANCE_UPDATE' | 'STRATEGY_SIGNAL';
  accountId: string;
  data: any;
  timestamp: Date;
}

export interface PaperAccountUpdateEvent extends PaperTradingEvent {
  type: 'ACCOUNT_UPDATE';
  data: {
    balance: number;
    equity: number;
    unrealizedPnL: number;
    marginUsed: number;
    marginLevel: number;
  };
}

export interface PaperOrderUpdateEvent extends PaperTradingEvent {
  type: 'ORDER_UPDATE';
  data: {
    order: PaperOrder;
    executionReport: PaperExecutionReport;
  };
}

export interface PaperPositionUpdateEvent extends PaperTradingEvent {
  type: 'POSITION_UPDATE';
  data: {
    position: PaperPosition;
    priceChange: number;
    pnlChange: number;
  };
}

export interface PaperTradeExecutionEvent extends PaperTradingEvent {
  type: 'TRADE_EXECUTION';
  data: {
    trade: PaperTrade;
    position?: PaperPosition;
    newBalance: number;
    realizedPnL: number;
  };
}

export interface PaperStrategySignalEvent extends PaperTradingEvent {
  type: 'STRATEGY_SIGNAL';
  data: {
    signal: PaperTradingSignal;
    executed: boolean;
    rejectionReason?: string;
  };
}

// Configuration and Settings
export interface PaperTradingConfiguration {
  commission: number;
  commissionAsset: string;
  slippage: number;
  maxSlippage: number;
  executionDelay: number;
  priceUpdateInterval: number;
  marginRequirement: number;
  liquidationThreshold: number;
  maxLeverage: number;
  allowedSymbols: string[];
  tradingHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  riskLimits: {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxPositions: number;
    maxPositionSize: number;
  };
}

export interface PaperTradingStatistics {
  totalAccounts: number;
  activeAccounts: number;
  totalTrades24h: number;
  totalVolume24h: number;
  averageWinRate: number;
  topPerformers: Array<{
    accountId: string;
    accountName: string;
    totalPnL: number;
    totalPnLPercentage: number;
    winRate: number;
  }>;
  systemLoad: {
    activeOrders: number;
    openPositions: number;
    strategiesRunning: number;
  };
}

export interface PaperTradingService {
  // Account Management
  createAccount(userId: string, config: Partial<PaperTradingAccount>): Promise<PaperTradingAccount>;
  getAccount(accountId: string): Promise<PaperTradingAccount | null>;
  updateAccount(accountId: string, updates: Partial<PaperTradingAccount>): Promise<PaperTradingAccount>;
  deleteAccount(accountId: string): Promise<boolean>;

  // Order Management
  createOrder(accountId: string, orderData: Partial<PaperOrder>): Promise<PaperOrder>;
  cancelOrder(accountId: string, orderId: string): Promise<boolean>;
  getOrder(orderId: string): Promise<PaperOrder | null>;
  getOrders(accountId: string, filters?: any): Promise<PaperOrder[]>;

  // Position Management
  getPositions(accountId: string, filters?: any): Promise<PaperPosition[]>;
  closePosition(accountId: string, positionId: string): Promise<boolean>;
  updatePosition(positionId: string, marketPrice: number): Promise<PaperPosition>;

  // Trading Operations
  executeOrder(order: PaperOrder, marketPrice: number): Promise<PaperTrade[]>;
  processSignal(accountId: string, signal: PaperTradingSignal): Promise<PaperOrder | null>;
  calculatePnL(position: PaperPosition, currentPrice: number): Promise<number>;

  // Portfolio Management
  getPortfolio(accountId: string): Promise<PaperPortfolio>;
  updatePortfolioValue(accountId: string): Promise<PaperPortfolio>;
  calculateMarginLevel(accountId: string): Promise<number>;

  // Performance and Analytics
  getPerformance(accountId: string): Promise<PaperAccountStatistics>;
  getStatistics(): Promise<PaperTradingStatistics>;
}