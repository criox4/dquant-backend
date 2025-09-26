// Common types used throughout the application

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

// Environment types
export type Environment = 'development' | 'production' | 'test';

// Status types
export type Status = 'active' | 'inactive' | 'pending' | 'error';

// Generic ID type
export type UUID = string;

// Database connection status
export interface HealthCheck {
  database: boolean;
  redis: boolean;
  binance?: boolean;
  openrouter?: boolean;
  timestamp: string;
}

// Request context
export interface RequestContext {
  userId?: string;
  conversationId?: string;
  sessionId?: string;
  ip: string;
  userAgent?: string;
  timestamp: string;
}

// Generic filter type
export interface FilterOptions {
  [key: string]: unknown;
}

// Sort options
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

// Query options that combine pagination, filtering, and sorting
export interface QueryOptions extends PaginationOptions {
  filters?: FilterOptions;
  sort?: SortOptions;
}

// Generic service response
export type ServiceResponse<T> = Promise<T>;

// Decimal precision type for financial calculations
export type DecimalString = string;

// Trading specific types
export type TradingPair = string; // e.g., 'BTC/USDT'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

// WebSocket event types
export interface WebSocketEvent<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
  room?: string;
}