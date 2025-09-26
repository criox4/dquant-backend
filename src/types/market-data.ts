/**
 * Market Data Types - Real-time and Historical Data Management
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
  timeframe: string;
}

export interface Ticker {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface Trade {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface MarketDataSubscription {
  id: string;
  symbol: string;
  type: MarketDataType;
  timeframe?: string;
  callback: (data: any) => void;
  isActive: boolean;
  createdAt: Date;
}

export type MarketDataType = 'candles' | 'ticker' | 'orderbook' | 'trades';

export interface MarketDataRequest {
  symbol: string;
  timeframe: string;
  from?: number;
  to?: number;
  limit?: number;
}

export interface MarketDataResponse<T> {
  success: boolean;
  data: T[];
  symbol: string;
  timeframe?: string;
  timestamp: number;
  source: string;
}

export interface MarketDataProvider {
  name: string;
  isConnected: boolean;
  supportedSymbols: string[];
  supportedTimeframes: string[];
  rateLimits: RateLimit;
}

export interface RateLimit {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  currentUsage: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
}

export interface MarketDataCache {
  symbol: string;
  timeframe: string;
  data: Candle[];
  lastUpdate: number;
  expiresAt: number;
}

export interface MarketDataEvent {
  type: 'candle' | 'ticker' | 'orderbook' | 'trade' | 'error' | 'connection';
  symbol: string;
  data: any;
  timestamp: number;
  source: string;
}

export interface WebSocketMessage {
  channel: string;
  event: string;
  data: any;
  timestamp: number;
}

export interface MarketDataConfiguration {
  providers: {
    primary: string;
    fallback: string[];
  };
  cache: {
    ttl: number;
    maxSize: number;
    enableCompression: boolean;
  };
  websocket: {
    reconnectDelay: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
  };
  rateLimiting: {
    enabled: boolean;
    strictMode: boolean;
    backoffStrategy: 'linear' | 'exponential';
  };
}

export interface MarketDataStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  activeSubscriptions: number;
  dataPointsReceived: number;
  uptime: number;
}

// Historical data interfaces
export interface HistoricalDataRequest {
  symbol: string;
  timeframe: string;
  startTime: number;
  endTime: number;
  limit?: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Real-time streaming interfaces
export interface StreamConfig {
  symbol: string;
  channels: string[];
  onData: (data: any) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface MarketDataFeed {
  subscribe(config: StreamConfig): string;
  unsubscribe(subscriptionId: string): boolean;
  getActiveSubscriptions(): MarketDataSubscription[];
  isConnected(): boolean;
  reconnect(): Promise<void>;
  disconnect(): void;
}