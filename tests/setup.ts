// Test environment setup
import { config } from '@/config/environment';

// Override environment for testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests

// Mock external services for testing
jest.mock('@/services/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  },
  apiLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  },
  databaseLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  },
  redisLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  },
  websocketLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  },
  requestLogger: {
    logRequest: jest.fn(),
    logResponse: jest.fn(),
    logError: jest.fn()
  },
  tradingLogger: {
    logTradeExecuted: jest.fn(),
    logStrategyStarted: jest.fn(),
    logStrategyStopped: jest.fn(),
    logPositionOpened: jest.fn(),
    logPositionClosed: jest.fn(),
    logRiskManagementTriggered: jest.fn()
  }
}));

// Global test timeout
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Add cleanup logic here if needed
});