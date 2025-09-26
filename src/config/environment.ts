import { z } from 'zod';
import dotenv from 'dotenv';
import { AppConfig } from '@/types/config';

// Load environment variables
dotenv.config();

// Zod schema for environment validation
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database Configuration
  DATABASE_URL: z.string().url('Invalid database URL'),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL'),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Binance Configuration
  BINANCE_API_KEY: z.string().min(1, 'Binance API key is required'),
  BINANCE_SECRET: z.string().min(1, 'Binance secret is required'),
  ENABLE_LIVE_TRADING: z.coerce.boolean().default(false),

  // OpenRouter AI Configuration
  OPENROUTER_API_KEY: z.string().min(1, 'OpenRouter API key is required'),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  DEFAULT_MODEL: z.string().default('anthropic/claude-sonnet-4'),

  // Security Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),

  // Trading Configuration
  MAX_DAILY_LOSS: z.coerce.number().positive().default(500),
  MAX_OPEN_POSITIONS: z.coerce.number().positive().default(5),
  MAX_POSITION_SIZE: z.coerce.number().positive().default(10000),
  MIN_ACCOUNT_BALANCE: z.coerce.number().positive().default(1000),

  // External Services
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SOCKET_PORT: z.coerce.number().optional()
});

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  parseResult.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const env = parseResult.data;

// Create typed configuration object
export const config: AppConfig = {
  // Server Configuration
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  HOST: env.HOST,
  LOG_LEVEL: env.LOG_LEVEL,

  // Database Configuration
  DATABASE_URL: env.DATABASE_URL,

  // Redis Configuration
  REDIS_URL: env.REDIS_URL,
  REDIS_HOST: env.REDIS_HOST,
  REDIS_PORT: env.REDIS_PORT,
  REDIS_PASSWORD: env.REDIS_PASSWORD,

  // Binance Configuration
  BINANCE_API_KEY: env.BINANCE_API_KEY,
  BINANCE_SECRET: env.BINANCE_SECRET,
  ENABLE_LIVE_TRADING: env.ENABLE_LIVE_TRADING,

  // OpenRouter Configuration
  OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL,
  DEFAULT_MODEL: env.DEFAULT_MODEL,

  // Security Configuration
  JWT_SECRET: env.JWT_SECRET,
  SESSION_SECRET: env.SESSION_SECRET,

  // Trading Configuration
  MAX_DAILY_LOSS: env.MAX_DAILY_LOSS,
  MAX_OPEN_POSITIONS: env.MAX_OPEN_POSITIONS,
  MAX_POSITION_SIZE: env.MAX_POSITION_SIZE,
  MIN_ACCOUNT_BALANCE: env.MIN_ACCOUNT_BALANCE,

  // External Services
  FRONTEND_URL: env.FRONTEND_URL,
  SOCKET_PORT: env.SOCKET_PORT,

  // Computed values
  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
  IS_TEST: env.NODE_ENV === 'test'
};

// Validate critical configuration for production
if (config.IS_PRODUCTION) {
  const requiredProductionConfig = [
    'DATABASE_URL',
    'REDIS_URL',
    'BINANCE_API_KEY',
    'BINANCE_SECRET',
    'OPENROUTER_API_KEY',
    'JWT_SECRET',
    'SESSION_SECRET'
  ] as const;

  const missingConfig = requiredProductionConfig.filter(key => !config[key]);

  if (missingConfig.length > 0) {
    console.error('❌ Missing required production configuration:');
    missingConfig.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }
}

// Log configuration (excluding secrets)
console.log('✅ Configuration loaded successfully');
console.log(`📊 Environment: ${config.NODE_ENV}`);
console.log(`🚀 Port: ${config.PORT}`);
console.log(`📡 Host: ${config.HOST}`);
console.log(`📝 Log Level: ${config.LOG_LEVEL}`);
console.log(`💰 Live Trading: ${config.ENABLE_LIVE_TRADING ? 'ENABLED' : 'DISABLED'}`);

if (config.IS_DEVELOPMENT) {
  console.log('🛠️ Development mode: Enhanced logging enabled');
}

export default config;