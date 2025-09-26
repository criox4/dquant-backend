import winston from 'winston';
import { config } from '@/config/environment';
import {
  Logger,
  LogContext,
  LogLevel,
  CategoryLogger,
  LogCategory,
  RequestLogger,
  TradingLogger,
  PerformanceLogger,
  PerformanceTimer
} from '@/types/logging';

// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, context, error, ...meta }) => {
    const logEntry: any = {
      timestamp,
      level,
      message,
      ...(context && { context }),
      ...(error && { error }),
      ...meta
    };

    return JSON.stringify(logEntry, null, config.IS_DEVELOPMENT ? 2 : 0);
  })
);

// Development format for better readability
const developmentFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, context, error }) => {
    let logMessage = `${timestamp} [${level}] ${message}`;

    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      logMessage += ` (${contextStr})`;
    }

    if (error) {
      logMessage += `\n  Error: ${error.message}`;
      if (error.stack && config.LOG_LEVEL === 'debug') {
        logMessage += `\n  Stack: ${error.stack}`;
      }
    }

    return logMessage;
  })
);

// Create Winston logger instance
const winstonLogger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.IS_DEVELOPMENT ? developmentFormat : customFormat,
  defaultMeta: {
    service: 'dquant-backend-ts',
    environment: config.NODE_ENV
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Add file transports for production
if (config.IS_PRODUCTION) {
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: customFormat
    })
  );

  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      format: customFormat
    })
  );
}

// Base logger implementation
class BaseLogger implements Logger {
  constructor(private winston: winston.Logger, private defaultContext?: LogContext) {}

  private formatMessage(message: string, context?: LogContext): [string, LogContext | undefined] {
    const mergedContext = { ...this.defaultContext, ...context };
    return [message, Object.keys(mergedContext).length > 0 ? mergedContext : undefined];
  }

  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void {
    if (errorOrContext instanceof Error) {
      const [formattedMessage, mergedContext] = this.formatMessage(message, context);
      this.winston.error(formattedMessage, {
        context: mergedContext,
        error: {
          name: errorOrContext.name,
          message: errorOrContext.message,
          stack: errorOrContext.stack
        }
      });
    } else {
      const [formattedMessage, mergedContext] = this.formatMessage(message, errorOrContext);
      this.winston.error(formattedMessage, { context: mergedContext });
    }
  }

  warn(message: string, context?: LogContext): void {
    const [formattedMessage, mergedContext] = this.formatMessage(message, context);
    this.winston.warn(formattedMessage, { context: mergedContext });
  }

  info(message: string, context?: LogContext): void {
    const [formattedMessage, mergedContext] = this.formatMessage(message, context);
    this.winston.info(formattedMessage, { context: mergedContext });
  }

  debug(message: string, context?: LogContext): void {
    const [formattedMessage, mergedContext] = this.formatMessage(message, context);
    this.winston.debug(formattedMessage, { context: mergedContext });
  }

  trace(message: string, context?: LogContext): void {
    // Winston doesn't have trace level, use debug
    const [formattedMessage, mergedContext] = this.formatMessage(message, context);
    this.winston.debug(`[TRACE] ${formattedMessage}`, { context: mergedContext });
  }
}

// Category logger implementation
class CategoryLoggerImpl extends BaseLogger implements CategoryLogger {
  constructor(
    winston: winston.Logger,
    public category: LogCategory,
    defaultContext?: LogContext
  ) {
    super(winston, { ...defaultContext, component: category });
  }

  child(context: LogContext): CategoryLogger {
    return new CategoryLoggerImpl(
      this.winston,
      this.category,
      { ...this.defaultContext, ...context }
    );
  }
}

// Request logger implementation
class RequestLoggerImpl extends BaseLogger implements RequestLogger {
  logRequest(method: string, url: string, context?: LogContext): void {
    this.info(`${method} ${url}`, { ...context, method, url });
  }

  logResponse(statusCode: number, responseTime: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this[level](`Response ${statusCode} (${responseTime}ms)`, {
      ...context,
      statusCode,
      responseTime
    });
  }

  logError(error: Error, context?: LogContext): void {
    this.error('Request error', error, context);
  }
}

// Trading logger implementation
class TradingLoggerImpl extends BaseLogger implements TradingLogger {
  logTradeExecuted(tradeId: string, context: LogContext): void {
    this.info('Trade executed', { ...context, tradeId, operation: 'trade_executed' });
  }

  logStrategyStarted(strategyId: string, context: LogContext): void {
    this.info('Strategy started', { ...context, strategyId, operation: 'strategy_started' });
  }

  logStrategyStopped(strategyId: string, context: LogContext): void {
    this.info('Strategy stopped', { ...context, strategyId, operation: 'strategy_stopped' });
  }

  logPositionOpened(positionId: string, context: LogContext): void {
    this.info('Position opened', { ...context, positionId, operation: 'position_opened' });
  }

  logPositionClosed(positionId: string, context: LogContext): void {
    this.info('Position closed', { ...context, positionId, operation: 'position_closed' });
  }

  logRiskManagementTriggered(reason: string, context: LogContext): void {
    this.warn('Risk management triggered', {
      ...context,
      reason,
      operation: 'risk_management_triggered'
    });
  }
}

// Performance logger implementation
class PerformanceLoggerImpl extends BaseLogger implements PerformanceLogger {
  startTimer(operation: string): PerformanceTimer {
    return {
      operation,
      startTime: Date.now()
    };
  }

  endTimer(timer: PerformanceTimer): void {
    const endTime = Date.now();
    const duration = endTime - timer.startTime;

    this.debug(`Operation completed: ${timer.operation}`, {
      ...timer.context,
      operation: timer.operation,
      performance: {
        startTime: timer.startTime,
        endTime,
        duration
      }
    });
  }
}

// Create logger instances
export const logger = new BaseLogger(winstonLogger);

export const createCategoryLogger = (category: LogCategory, context?: LogContext): CategoryLogger => {
  return new CategoryLoggerImpl(winstonLogger, category, context);
};

export const requestLogger = new RequestLoggerImpl(winstonLogger, { component: 'api' });
export const tradingLogger = new TradingLoggerImpl(winstonLogger, { component: 'trading' });
export const performanceLogger = new PerformanceLoggerImpl(winstonLogger, { component: 'performance' });

// Specialized loggers for different components
export const apiLogger = createCategoryLogger('api');
export const databaseLogger = createCategoryLogger('database');
export const redisLogger = createCategoryLogger('redis');
export const websocketLogger = createCategoryLogger('websocket');
export const strategyLogger = createCategoryLogger('strategy');
export const binanceLogger = createCategoryLogger('binance');
export const openrouterLogger = createCategoryLogger('openrouter');
export const securityLogger = createCategoryLogger('security');

// Export Winston instance for advanced usage
export { winstonLogger };

// Log application startup
logger.info('Logger initialized', {
  level: config.LOG_LEVEL,
  environment: config.NODE_ENV,
  transports: winstonLogger.transports.length
});