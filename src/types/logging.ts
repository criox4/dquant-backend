// Logging types and interfaces

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface LogContext {
  requestId?: string;
  userId?: string;
  conversationId?: string;
  strategyId?: string;
  tradeId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string | undefined;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  component?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface LogMetadata {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  performance?: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface Logger {
  error(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  trace(message: string, context?: LogContext): void;
}

export interface RequestLogger {
  logRequest(method: string, url: string, context?: LogContext): void;
  logResponse(statusCode: number, responseTime: number, context?: LogContext): void;
  logError(error: Error, context?: LogContext): void;
}

export interface TradingLogger {
  logTradeExecuted(tradeId: string, context: LogContext): void;
  logStrategyStarted(strategyId: string, context: LogContext): void;
  logStrategyStopped(strategyId: string, context: LogContext): void;
  logPositionOpened(positionId: string, context: LogContext): void;
  logPositionClosed(positionId: string, context: LogContext): void;
  logRiskManagementTriggered(reason: string, context: LogContext): void;
}

export interface PerformanceLogger {
  startTimer(operation: string): PerformanceTimer;
  endTimer(timer: PerformanceTimer): void;
}

export interface PerformanceTimer {
  operation: string;
  startTime: number;
  context?: LogContext;
}

// Log formatting options
export interface LogFormatOptions {
  colorize?: boolean;
  timestamp?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
  includeStack?: boolean;
}

// Winston transport configuration
export interface TransportConfig {
  level: LogLevel;
  filename?: string;
  maxsize?: number;
  maxFiles?: number;
  format?: unknown;
  handleExceptions?: boolean;
  handleRejections?: boolean;
}

// Application-specific log categories
export type LogCategory =
  | 'app'
  | 'api'
  | 'database'
  | 'redis'
  | 'websocket'
  | 'trading'
  | 'strategy'
  | 'binance'
  | 'openrouter'
  | 'security'
  | 'performance';

export interface CategoryLogger extends Logger {
  category: LogCategory;
  child(context: LogContext): CategoryLogger;
}