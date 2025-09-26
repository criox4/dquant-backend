/**
 * Market Data Service - Real-time and Historical Data Provider
 * Comprehensive market data management with WebSocket streaming and caching
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  Candle,
  Ticker,
  OrderBook,
  Trade,
  MarketDataSubscription,
  MarketDataRequest,
  MarketDataResponse,
  MarketDataProvider,
  MarketDataCache,
  MarketDataEvent,
  MarketDataConfiguration,
  MarketDataStats,
  MarketDataFeed,
  StreamConfig,
  OHLCV,
  HistoricalDataRequest
} from '@/types/market-data';
import { apiLogger, performanceLogger } from '@/services/logger';

export class MarketDataService extends EventEmitter implements MarketDataFeed {
  private subscriptions = new Map<string, MarketDataSubscription>();
  private cache = new Map<string, MarketDataCache>();
  private providers = new Map<string, MarketDataProvider>();
  private websockets = new Map<string, WebSocket>();
  private config: MarketDataConfiguration;
  private stats: MarketDataStats;
  private isInitialized = false;

  constructor(config?: Partial<MarketDataConfiguration>) {
    super();

    this.config = {
      providers: {
        primary: 'binance',
        fallback: ['coinbase', 'kraken']
      },
      cache: {
        ttl: 60000, // 1 minute
        maxSize: 1000,
        enableCompression: false
      },
      websocket: {
        reconnectDelay: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000
      },
      rateLimiting: {
        enabled: true,
        strictMode: false,
        backoffStrategy: 'exponential'
      },
      ...config
    };

    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      activeSubscriptions: 0,
      dataPointsReceived: 0,
      uptime: Date.now()
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      apiLogger.info('Initializing Market Data Service');

      // Initialize providers
      await this.initializeProviders();

      // Setup cache cleanup
      this.setupCacheCleanup();

      // Setup heartbeat
      this.setupHeartbeat();

      this.isInitialized = true;
      apiLogger.info('Market Data Service initialized successfully', {
        providers: Array.from(this.providers.keys()),
        cacheEnabled: true,
        websocketEnabled: true
      });

    } catch (error) {
      apiLogger.error('Failed to initialize Market Data Service', error as Error);
      throw error;
    }
  }

  private async initializeProviders(): Promise<void> {
    // Binance provider
    this.providers.set('binance', {
      name: 'Binance',
      isConnected: false,
      supportedSymbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'DOT/USDT'],
      supportedTimeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 1200,
        requestsPerHour: 100000,
        currentUsage: {
          perSecond: 0,
          perMinute: 0,
          perHour: 0
        }
      }
    });

    // Coinbase provider (fallback)
    this.providers.set('coinbase', {
      name: 'Coinbase Pro',
      isConnected: false,
      supportedSymbols: ['BTC/USD', 'ETH/USD', 'LTC/USD'],
      supportedTimeframes: ['1m', '5m', '15m', '1h', '6h', '1d'],
      rateLimits: {
        requestsPerSecond: 5,
        requestsPerMinute: 300,
        requestsPerHour: 10000,
        currentUsage: {
          perSecond: 0,
          perMinute: 0,
          perHour: 0
        }
      }
    });
  }

  /**
   * Get historical candle data
   */
  async getHistoricalData(request: HistoricalDataRequest): Promise<MarketDataResponse<Candle>> {
    const timer = performanceLogger.startTimer(`getHistoricalData:${request.symbol}`);
    this.stats.totalRequests++;

    try {
      const cacheKey = this.generateCacheKey(request.symbol, request.timeframe, 'historical');

      // Check cache first
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData && this.isCacheValid(cachedData)) {
        this.stats.successfulRequests++;
        performanceLogger.endTimer(timer);

        return {
          success: true,
          data: cachedData.data,
          symbol: request.symbol,
          timeframe: request.timeframe,
          timestamp: Date.now(),
          source: 'cache'
        };
      }

      // Fetch from provider
      const data = await this.fetchHistoricalData(request);

      // Cache the result
      this.setCache(cacheKey, {
        symbol: request.symbol,
        timeframe: request.timeframe,
        data,
        lastUpdate: Date.now(),
        expiresAt: Date.now() + this.config.cache.ttl
      });

      this.stats.successfulRequests++;
      performanceLogger.endTimer(timer);

      apiLogger.info('Historical data retrieved', {
        symbol: request.symbol,
        timeframe: request.timeframe,
        dataPoints: data.length,
        source: 'provider'
      });

      return {
        success: true,
        data,
        symbol: request.symbol,
        timeframe: request.timeframe,
        timestamp: Date.now(),
        source: 'provider'
      };

    } catch (error) {
      this.stats.failedRequests++;
      performanceLogger.endTimer(timer);

      apiLogger.error('Failed to get historical data', error as Error, {
        symbol: request.symbol,
        timeframe: request.timeframe
      });

      return {
        success: false,
        data: [],
        symbol: request.symbol,
        timeframe: request.timeframe,
        timestamp: Date.now(),
        source: 'error'
      };
    }
  }

  /**
   * Get real-time ticker data
   */
  async getTicker(symbol: string): Promise<Ticker | null> {
    const timer = performanceLogger.startTimer(`getTicker:${symbol}`);
    this.stats.totalRequests++;

    try {
      const cacheKey = this.generateCacheKey(symbol, '1m', 'ticker');
      const cachedData = this.getFromCache(cacheKey);

      if (cachedData && this.isCacheValid(cachedData)) {
        performanceLogger.endTimer(timer);
        return cachedData.data[0] as Ticker;
      }

      // Mock ticker data (replace with actual API call)
      const ticker: Ticker = {
        symbol,
        price: Math.random() * 50000 + 40000, // Mock BTC price
        change24h: (Math.random() - 0.5) * 2000,
        changePercent24h: (Math.random() - 0.5) * 10,
        high24h: Math.random() * 52000 + 48000,
        low24h: Math.random() * 42000 + 38000,
        volume24h: Math.random() * 1000000000,
        timestamp: Date.now()
      };

      this.stats.successfulRequests++;
      performanceLogger.endTimer(timer);

      return ticker;

    } catch (error) {
      this.stats.failedRequests++;
      performanceLogger.endTimer(timer);

      apiLogger.error('Failed to get ticker', error as Error, { symbol });
      return null;
    }
  }

  /**
   * Subscribe to real-time data stream
   */
  subscribe(config: StreamConfig): string {
    const subscriptionId = this.generateSubscriptionId();

    const subscription: MarketDataSubscription = {
      id: subscriptionId,
      symbol: config.symbol,
      type: 'candles', // Default type
      callback: config.onData,
      isActive: true,
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.stats.activeSubscriptions++;

    // Start WebSocket connection if needed
    this.connectWebSocket(config.symbol, subscriptionId);

    apiLogger.info('Market data subscription created', {
      subscriptionId,
      symbol: config.symbol,
      totalSubscriptions: this.stats.activeSubscriptions
    });

    return subscriptionId;
  }

  /**
   * Unsubscribe from data stream
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);
    this.stats.activeSubscriptions--;

    apiLogger.info('Market data subscription cancelled', {
      subscriptionId,
      symbol: subscription.symbol,
      totalSubscriptions: this.stats.activeSubscriptions
    });

    return true;
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(): MarketDataSubscription[] {
    return Array.from(this.subscriptions.values()).filter(sub => sub.isActive);
  }

  /**
   * Check if service is connected
   */
  isConnected(): boolean {
    return this.isInitialized && this.websockets.size > 0;
  }

  /**
   * Reconnect WebSocket connections
   */
  async reconnect(): Promise<void> {
    apiLogger.info('Reconnecting market data streams');

    // Close existing connections
    this.websockets.forEach(ws => ws.close());
    this.websockets.clear();

    // Reconnect active subscriptions
    const activeSubscriptions = this.getActiveSubscriptions();
    for (const subscription of activeSubscriptions) {
      this.connectWebSocket(subscription.symbol, subscription.id);
    }
  }

  /**
   * Disconnect all streams
   */
  disconnect(): void {
    apiLogger.info('Disconnecting market data streams');

    this.websockets.forEach(ws => ws.close());
    this.websockets.clear();

    this.subscriptions.clear();
    this.stats.activeSubscriptions = 0;
  }

  /**
   * Get service statistics
   */
  getStats(): MarketDataStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.uptime,
      cacheHitRate: this.stats.totalRequests > 0
        ? (this.stats.successfulRequests / this.stats.totalRequests) * 100
        : 0
    };
  }

  private async fetchHistoricalData(request: HistoricalDataRequest): Promise<Candle[]> {
    // Mock historical data generation
    const candles: Candle[] = [];
    const timeframeMs = this.timeframeToMs(request.timeframe);
    const dataPoints = Math.min(100, Math.floor((request.endTime - request.startTime) / timeframeMs));

    let basePrice = 45000; // Mock BTC price

    for (let i = 0; i < dataPoints; i++) {
      const timestamp = request.startTime + (i * timeframeMs);
      const volatility = 0.02; // 2% volatility

      const open = basePrice * (1 + (Math.random() - 0.5) * volatility);
      const close = open * (1 + (Math.random() - 0.5) * volatility);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
      const volume = Math.random() * 100;

      candles.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        symbol: request.symbol,
        timeframe: request.timeframe
      });

      basePrice = close;
    }

    return candles;
  }

  private connectWebSocket(symbol: string, subscriptionId: string): void {
    // Mock WebSocket connection (replace with actual WebSocket URL)
    const wsKey = `${symbol}_${subscriptionId}`;

    try {
      // In production, replace with actual WebSocket URL
      // const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

      // Mock periodic data generation
      const interval = setInterval(() => {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription || !subscription.isActive) {
          clearInterval(interval);
          return;
        }

        // Generate mock real-time data
        const mockCandle: Candle = {
          timestamp: Date.now(),
          open: Math.random() * 50000 + 40000,
          high: Math.random() * 52000 + 48000,
          low: Math.random() * 48000 + 38000,
          close: Math.random() * 51000 + 39000,
          volume: Math.random() * 100,
          symbol: subscription.symbol,
          timeframe: '1m'
        };

        // Call subscription callback
        subscription.callback(mockCandle);
        this.stats.dataPointsReceived++;

        // Emit event
        this.emit('data', {
          type: 'candle',
          symbol: subscription.symbol,
          data: mockCandle,
          timestamp: Date.now(),
          source: 'websocket'
        } as MarketDataEvent);

      }, 5000); // Mock data every 5 seconds

      apiLogger.info('WebSocket connection established', {
        symbol,
        subscriptionId
      });

    } catch (error) {
      apiLogger.error('Failed to connect WebSocket', error as Error, {
        symbol,
        subscriptionId
      });
    }
  }

  private generateCacheKey(symbol: string, timeframe: string, type: string): string {
    return `${type}_${symbol}_${timeframe}`;
  }

  private getFromCache(key: string): MarketDataCache | undefined {
    return this.cache.get(key);
  }

  private setCache(key: string, data: MarketDataCache): void {
    if (this.cache.size >= this.config.cache.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, data);
  }

  private isCacheValid(cache: MarketDataCache): boolean {
    return Date.now() < cache.expiresAt;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private timeframeToMs(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };

    return timeframes[timeframe] || 60 * 1000;
  }

  private setupCacheCleanup(): void {
    // Cleanup expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, cache] of this.cache.entries()) {
        if (now > cache.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  private setupHeartbeat(): void {
    // Send heartbeat every 30 seconds
    setInterval(() => {
      this.emit('heartbeat', {
        timestamp: Date.now(),
        stats: this.getStats(),
        activeConnections: this.websockets.size
      });
    }, this.config.websocket.heartbeatInterval);
  }
}

// Singleton instance
export const marketDataService = new MarketDataService();