// Environment configuration types

export interface DatabaseConfig {
  DATABASE_URL: string;
}

export interface RedisConfig {
  REDIS_URL: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
}

export interface ServerConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export interface BinanceConfig {
  BINANCE_API_KEY: string;
  BINANCE_SECRET: string;
  ENABLE_LIVE_TRADING: boolean;
}

export interface OpenRouterConfig {
  OPENROUTER_API_KEY: string;
  OPENROUTER_BASE_URL: string;
  DEFAULT_MODEL: string;
}

export interface SecurityConfig {
  JWT_SECRET: string;
  SESSION_SECRET: string;
}

export interface TradingConfig {
  MAX_DAILY_LOSS: number;
  MAX_OPEN_POSITIONS: number;
  MAX_POSITION_SIZE: number;
  MIN_ACCOUNT_BALANCE: number;
}

export interface ExternalServiceConfig {
  FRONTEND_URL: string;
  SOCKET_PORT?: number;
}

// Complete application configuration
export interface AppConfig extends
  DatabaseConfig,
  RedisConfig,
  ServerConfig,
  BinanceConfig,
  OpenRouterConfig,
  SecurityConfig,
  TradingConfig,
  ExternalServiceConfig {
  // Additional computed or derived config values
  IS_PRODUCTION: boolean;
  IS_DEVELOPMENT: boolean;
  IS_TEST: boolean;
}

// Configuration validation schema
export interface ConfigValidationSchema {
  required: (keyof AppConfig)[];
  optional: (keyof AppConfig)[];
  defaults: Partial<AppConfig>;
}