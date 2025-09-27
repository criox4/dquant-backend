/**
 * Live Trading Type Definitions
 * Comprehensive types for live trading operations using CCXT
 */

import { Decimal } from '@prisma/client/runtime/library';

// CCXT-compatible types
export interface CCXTOrder {
  id: string;
  clientOrderId?: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  filled: number;
  remaining: number;
  cost: number;
  status: 'open' | 'closed' | 'canceled' | 'expired' | 'rejected';
  timestamp: number;
  datetime: string;
  fee?: {
    currency: string;
    cost: number;
    rate?: number;
  };
  trades?: CCXTTrade[];
  info: any; // Raw exchange response
}

export interface CCXTTrade {
  id: string;
  order?: string;
  symbol: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  cost: number;
  timestamp: number;
  datetime: string;
  fee?: {
    currency: string;
    cost: number;
    rate?: number;
  };
  info: any;
}

export interface CCXTPosition {
  id?: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  contracts: number;
  contractSize: number;
  entryPrice: number;
  markPrice: number;
  notional: number;
  leverage: number;
  unrealizedPnl: number;
  percentage: number;
  marginType?: 'cross' | 'isolated';
  liquidationPrice?: number;
  timestamp: number;
  datetime: string;
  info: any;
}

export interface CCXTBalance {
  free: { [currency: string]: number };
  used: { [currency: string]: number };
  total: { [currency: string]: number };
  info: any;
}

export interface CCXTTicker {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  close: number;
  bid: number;
  ask: number;
  baseVolume: number;
  quoteVolume: number;
  percentage: number;
  change: number;
  timestamp: number;
  datetime: string;
  info: any;
}

export interface CCXTOrderBook {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  datetime: string;
  nonce?: number;
  info: any;
}

export interface CCXTCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Live Trading Service Types
export interface LiveTradingConfig {
  exchange: 'binance' | 'bybit' | 'okx';
  apiKey: string;
  secret: string;
  passphrase?: string; // For OKX
  sandbox: boolean;
  defaultType: 'spot' | 'future' | 'swap' | 'option';
  enableRateLimit: boolean;
  timeout: number;
  verbose: boolean;
  options?: {
    defaultType?: string;
    adjustForTimeDifference?: boolean;
    recvWindow?: number;
    [key: string]: any;
  };
}

export interface LiveTradingAccount {
  id: string;
  userId: string;
  exchangeName: string;
  accountType: 'spot' | 'futures' | 'margin';
  apiKeyId: string;
  isActive: boolean;
  balance: {
    totalWalletBalance: number;
    totalUnrealizedPnl: number;
    totalMarginBalance: number;
    availableBalance: number;
    totalCrossMargin: number;
    maxWithdrawAmount: number;
  };
  permissions: string[];
  riskConfig: {
    maxPositionSize: number;
    maxDailyLoss: number;
    maxLeverage: number;
    allowedAssets: string[];
    dailyTradingLimit: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveOrderParams {
  symbol: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  postOnly?: boolean;
  clientOrderId?: string;
  leverageRate?: number;
  marginMode?: 'cross' | 'isolated';
  params?: { [key: string]: any };
}

export interface LivePositionRequest {
  symbol?: string;
  type?: 'future' | 'swap';
}

export interface LiveBalanceRequest {
  type?: 'spot' | 'future' | 'margin';
  currency?: string;
}

// Live Trading Events
export enum LiveTradingEventType {
  ORDER_UPDATE = 'order_update',
  POSITION_UPDATE = 'position_update',
  BALANCE_UPDATE = 'balance_update',
  TRADE_EXECUTION = 'trade_execution',
  ERROR = 'error',
  CONNECTION = 'connection',
  RECONNECTION = 'reconnection',
  DISCONNECTION = 'disconnection'
}

export interface LiveTradingEvent {
  type: LiveTradingEventType;
  data: any;
  timestamp: number;
  accountId: string;
}

// Exchange Status
export interface ExchangeStatus {
  status: 'ok' | 'maintenance' | 'error';
  updated: number;
  eta?: number;
  url?: string;
  info: any;
}

// Market Information
export interface MarketInfo {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  settle?: string;
  baseId: string;
  quoteId: string;
  settleId?: string;
  type: 'spot' | 'future' | 'swap' | 'option';
  spot: boolean;
  margin: boolean;
  future: boolean;
  swap: boolean;
  option: boolean;
  active: boolean;
  contract: boolean;
  linear?: boolean;
  inverse?: boolean;
  contractSize?: number;
  expiry?: number;
  expiryDatetime?: string;
  strike?: number;
  optionType?: 'call' | 'put';
  precision: {
    amount: number;
    price: number;
    cost?: number;
  };
  limits: {
    amount: {
      min: number;
      max: number;
    };
    price: {
      min: number;
      max: number;
    };
    cost: {
      min: number;
      max: number;
    };
    leverage?: {
      min: number;
      max: number;
    };
  };
  info: any;
}

// Trading Statistics
export interface LiveTradingStats {
  accountId: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: number;
  totalPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  maxDrawdown: number;
  currentDrawdown: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  tradingDays: number;
  lastTradeAt?: Date;
  updatedAt: Date;
}

// Risk Management for Live Trading
export interface LiveRiskConfig {
  maxPositionSize: number; // Maximum position size in USDT
  maxLeverage: number; // Maximum leverage allowed
  maxDailyLoss: number; // Maximum daily loss in USDT
  maxOpenPositions: number; // Maximum number of open positions
  allowedSymbols: string[]; // Whitelist of allowed trading symbols
  forbiddenSymbols: string[]; // Blacklist of forbidden symbols
  enableStopLoss: boolean;
  enableTakeProfit: boolean;
  defaultStopLossPercentage: number;
  defaultTakeProfitPercentage: number;
  maxSlippage: number; // Maximum allowed slippage in %
  maxOrderValue: number; // Maximum order value in USDT
  cooldownPeriod: number; // Cooldown period between trades in seconds
  requireConfirmation: boolean; // Require manual confirmation for large trades
}

// Live Trading Service Interface
export interface ILiveTradingService {
  // Connection Management
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): ExchangeStatus;

  // Account Management
  getBalance(params?: LiveBalanceRequest): Promise<CCXTBalance>;
  getAccount(): Promise<LiveTradingAccount>;

  // Market Data
  getTicker(symbol: string): Promise<CCXTTicker>;
  getTickers(symbols?: string[]): Promise<{ [symbol: string]: CCXTTicker }>;
  getOrderBook(symbol: string, limit?: number): Promise<CCXTOrderBook>;
  getCandles(symbol: string, timeframe: string, since?: number, limit?: number): Promise<CCXTCandle[]>;
  getMarkets(): Promise<{ [symbol: string]: MarketInfo }>;

  // Trading Operations
  createOrder(params: LiveOrderParams): Promise<CCXTOrder>;
  cancelOrder(id: string, symbol: string): Promise<CCXTOrder>;
  cancelAllOrders(symbol?: string): Promise<CCXTOrder[]>;
  getOrder(id: string, symbol: string): Promise<CCXTOrder>;
  getOrders(symbol?: string, since?: number, limit?: number): Promise<CCXTOrder[]>;
  getOpenOrders(symbol?: string): Promise<CCXTOrder[]>;

  // Position Management
  getPositions(symbols?: string[]): Promise<CCXTPosition[]>;
  getPosition(symbol: string): Promise<CCXTPosition>;
  setLeverage(symbol: string, leverage: number): Promise<void>;
  setMarginMode(symbol: string, marginMode: 'cross' | 'isolated'): Promise<void>;

  // Trading History
  getTrades(symbol?: string, since?: number, limit?: number): Promise<CCXTTrade[]>;
  getMyTrades(symbol?: string, since?: number, limit?: number): Promise<CCXTTrade[]>;

  // Risk Management
  checkPreTradeRisk(params: LiveOrderParams): Promise<{ approved: boolean; reasons: string[] }>;
  getStats(): Promise<LiveTradingStats>;

  // WebSocket Subscriptions
  watchTicker(symbol: string, callback: (ticker: CCXTTicker) => void): Promise<void>;
  watchOrderBook(symbol: string, callback: (orderbook: CCXTOrderBook) => void): Promise<void>;
  watchTrades(symbol: string, callback: (trades: CCXTTrade[]) => void): Promise<void>;
  watchOrders(callback: (orders: CCXTOrder[]) => void): Promise<void>;
  watchPositions(callback: (positions: CCXTPosition[]) => void): Promise<void>;
  watchBalance(callback: (balance: CCXTBalance) => void): Promise<void>;

  // Unsubscribe
  unwatch(symbol?: string, channel?: string): Promise<void>;
  unwatchAll(): Promise<void>;
}

// Error Types
export class LiveTradingError extends Error {
  constructor(
    message: string,
    public code?: string,
    public exchange?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'LiveTradingError';
  }
}

export class InsufficientFundsError extends LiveTradingError {
  constructor(message: string, details?: any) {
    super(message, 'INSUFFICIENT_FUNDS', undefined, details);
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidOrderError extends LiveTradingError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_ORDER', undefined, details);
    this.name = 'InvalidOrderError';
  }
}

export class RiskManagementError extends LiveTradingError {
  constructor(message: string, details?: any) {
    super(message, 'RISK_MANAGEMENT', undefined, details);
    this.name = 'RiskManagementError';
  }
}

export class ExchangeConnectionError extends LiveTradingError {
  constructor(message: string, exchange: string, details?: any) {
    super(message, 'CONNECTION_ERROR', exchange, details);
    this.name = 'ExchangeConnectionError';
  }
}

// Export all types
export type {
  LiveTradingConfig,
  LiveTradingAccount,
  LiveOrderParams,
  LivePositionRequest,
  LiveBalanceRequest,
  LiveTradingEvent,
  ExchangeStatus,
  MarketInfo,
  LiveTradingStats,
  LiveRiskConfig,
  ILiveTradingService
};

