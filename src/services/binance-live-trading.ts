/**
 * Binance Live Trading Service
 * Professional-grade CCXT-based service for live futures trading
 */

import ccxt from 'ccxt';
import { EventEmitter } from 'events';
import { tradingLogger } from '@/services/logger';
import { riskManagementService } from '@/services/risk-management';
import { config } from '@/config/environment';
import {
  ILiveTradingService,
  LiveTradingConfig,
  LiveTradingAccount,
  LiveOrderParams,
  LivePositionRequest,
  LiveBalanceRequest,
  LiveTradingEvent,
  LiveTradingEventType,
  ExchangeStatus,
  MarketInfo,
  LiveTradingStats,
  LiveRiskConfig,
  CCXTOrder,
  CCXTTrade,
  CCXTPosition,
  CCXTBalance,
  CCXTTicker,
  CCXTOrderBook,
  CCXTCandle,
  LiveTradingError,
  InsufficientFundsError,
  InvalidOrderError,
  RiskManagementError,
  ExchangeConnectionError
} from '@/types/live-trading';

export class BinanceLiveTradingService extends EventEmitter implements ILiveTradingService {
  private exchange: ccxt.binance;
  private wsExchange?: ccxt.binance;
  private isConnectedFlag: boolean = false;
  private config: LiveTradingConfig;
  private watchedSymbols: Set<string> = new Set();
  private subscriptions: Map<string, any> = new Map();
  private lastPrices: Map<string, number> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;

  // Risk and rate limiting
  private riskConfig: LiveRiskConfig;
  private lastTradeTime: number = 0;
  private dailyTrades: number = 0;
  private dailyVolume: number = 0;
  private dailyPnl: number = 0;

  constructor(customConfig?: Partial<LiveTradingConfig>) {
    super();

    // Initialize configuration with proper CCXT settings
    this.config = {
      exchange: 'binance',
      apiKey: config.BINANCE_API_KEY || '',
      secret: config.BINANCE_SECRET || '',
      sandbox: config.NODE_ENV !== 'production',
      defaultType: 'future', // Use futures by default
      enableRateLimit: true,
      timeout: 30000,
      verbose: config.NODE_ENV === 'development',
      options: {
        defaultType: 'future',
        adjustForTimeDifference: true,
        recvWindow: 10000,
        warnOnFetchOpenOrdersWithoutSymbol: false,
      },
      ...customConfig
    };

    // Initialize risk configuration
    this.riskConfig = {
      maxPositionSize: 10000, // $10,000 max position
      maxLeverage: 10,
      maxDailyLoss: 1000, // $1,000 daily loss limit
      maxOpenPositions: 5,
      allowedSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'],
      forbiddenSymbols: [],
      enableStopLoss: true,
      enableTakeProfit: false,
      defaultStopLossPercentage: 2.0, // 2% stop loss
      defaultTakeProfitPercentage: 6.0, // 6% take profit
      maxSlippage: 0.5, // 0.5% max slippage
      maxOrderValue: 50000, // $50,000 max order value
      cooldownPeriod: 1000, // 1 second between trades
      requireConfirmation: true // Require confirmation for large trades
    };

    this.initializeExchange();
  }

  private initializeExchange(): void {
    try {
      // Create main REST exchange
      this.exchange = new ccxt.binance({
        apiKey: this.config.apiKey,
        secret: this.config.secret,
        sandbox: this.config.sandbox,
        enableRateLimit: this.config.enableRateLimit,
        timeout: this.config.timeout,
        verbose: this.config.verbose,
        options: this.config.options
      });

      // Create WebSocket exchange for real-time data
      if (ccxt.binance.prototype.hasOwnProperty('watchTicker')) {
        this.wsExchange = new ccxt.binance({
          apiKey: this.config.apiKey,
          secret: this.config.secret,
          sandbox: this.config.sandbox,
          enableRateLimit: this.config.enableRateLimit,
          timeout: this.config.timeout,
          verbose: this.config.verbose,
          options: {
            ...this.config.options,
            newUpdates: false // Use snapshot mode for better performance
          }
        });
      }

      tradingLogger.info('Binance Live Trading Service initialized', {
        sandbox: this.config.sandbox,
        defaultType: this.config.defaultType,
        hasWebSocket: !!this.wsExchange,
        component: 'live-trading'
      });

    } catch (error) {
      tradingLogger.error('Failed to initialize Binance exchange', {
        error: error.message,
        component: 'live-trading'
      });
      throw new ExchangeConnectionError('Failed to initialize Binance exchange', 'binance', error);
    }
  }

  // Connection Management
  async connect(): Promise<boolean> {
    try {
      tradingLogger.info('Connecting to Binance exchange...', { component: 'live-trading' });

      // Load markets
      await this.exchange.loadMarkets();

      // Test connection with a simple API call
      const time = await this.exchange.fetchTime();

      // Test account access
      const balance = await this.exchange.fetchBalance();

      this.isConnectedFlag = true;
      this.reconnectAttempts = 0;

      // Initialize WebSocket connection if available
      if (this.wsExchange) {
        await this.wsExchange.loadMarkets();
      }

      tradingLogger.info('Successfully connected to Binance', {
        serverTime: new Date(time),
        markets: Object.keys(this.exchange.markets).length,
        hasBalance: !!balance,
        component: 'live-trading'
      });

      this.emit('connected', { exchange: 'binance', timestamp: Date.now() });
      return true;

    } catch (error) {
      this.isConnectedFlag = false;

      tradingLogger.error('Failed to connect to Binance', {
        error: error.message,
        component: 'live-trading'
      });

      if (error.message.includes('Invalid API-key')) {
        throw new ExchangeConnectionError('Invalid API credentials', 'binance', error);
      } else if (error.message.includes('IP address')) {
        throw new ExchangeConnectionError('IP address not whitelisted', 'binance', error);
      } else {
        throw new ExchangeConnectionError('Connection failed', 'binance', error);
      }
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all WebSocket channels
      await this.unwatchAll();

      // Clear subscriptions
      this.subscriptions.clear();
      this.watchedSymbols.clear();

      this.isConnectedFlag = false;

      tradingLogger.info('Disconnected from Binance exchange', { component: 'live-trading' });
      this.emit('disconnected', { exchange: 'binance', timestamp: Date.now() });

    } catch (error) {
      tradingLogger.error('Error during disconnect', { error: error.message, component: 'live-trading' });
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  async getStatus(): Promise<ExchangeStatus> {
    try {
      const status = await this.exchange.fetchStatus();
      return {
        status: status.status === 'ok' ? 'ok' : 'error',
        updated: status.updated || Date.now(),
        eta: status.eta,
        url: status.url,
        info: status
      };
    } catch (error) {
      return {
        status: 'error',
        updated: Date.now(),
        info: { error: error.message }
      };
    }
  }

  // Account Management
  async getBalance(params?: LiveBalanceRequest): Promise<CCXTBalance> {
    try {
      this.ensureConnected();

      // For futures trading, we want the futures balance
      const balanceParams = params?.type === 'spot' ? {} : { type: 'future' };
      const balance = await this.exchange.fetchBalance(balanceParams);

      tradingLogger.info('Fetched account balance', {
        totalUSDT: balance.total?.USDT || 0,
        freeUSDT: balance.free?.USDT || 0,
        usedUSDT: balance.used?.USDT || 0,
        type: params?.type || 'future',
        component: 'live-trading'
      });

      return balance;

    } catch (error) {
      tradingLogger.error('Failed to fetch balance', { error: error.message, component: 'live-trading' });
      throw new LiveTradingError('Failed to fetch balance', 'BALANCE_ERROR', 'binance', error);
    }
  }

  async getAccount(): Promise<LiveTradingAccount> {
    try {
      this.ensureConnected();

      const balance = await this.getBalance();
      const accountInfo = await this.exchange.fetchAccountData?.() || {};

      // For futures, get additional margin info
      const marginInfo = this.config.defaultType === 'future' ?
        await this.exchange.fetchAccountData?.() || {} : {};

      const account: LiveTradingAccount = {
        id: accountInfo.account?.toString() || 'default',
        userId: 'live-user', // This would come from user context
        exchangeName: 'binance',
        accountType: this.config.defaultType as any,
        apiKeyId: this.config.apiKey.slice(-8),
        isActive: true,
        balance: {
          totalWalletBalance: balance.total?.USDT || 0,
          totalUnrealizedPnl: marginInfo.totalUnrealizedProfit || 0,
          totalMarginBalance: marginInfo.totalMarginBalance || balance.total?.USDT || 0,
          availableBalance: balance.free?.USDT || 0,
          totalCrossMargin: marginInfo.totalCrossMargin || 0,
          maxWithdrawAmount: marginInfo.maxWithdrawAmount || balance.free?.USDT || 0
        },
        permissions: accountInfo.permissions || ['SPOT', 'FUTURES'],
        riskConfig: this.riskConfig,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return account;

    } catch (error) {
      tradingLogger.error('Failed to fetch account info', { error: error.message, component: 'live-trading' });
      throw new LiveTradingError('Failed to fetch account info', 'ACCOUNT_ERROR', 'binance', error);
    }
  }

  // Market Data
  async getTicker(symbol: string): Promise<CCXTTicker> {
    try {
      this.ensureConnected();
      const ticker = await this.exchange.fetchTicker(symbol);

      // Cache the price for risk management
      this.lastPrices.set(symbol, ticker.last);

      return ticker;

    } catch (error) {
      tradingLogger.error('Failed to fetch ticker', { symbol, error: error.message, component: 'live-trading' });
      throw new LiveTradingError(`Failed to fetch ticker for ${symbol}`, 'TICKER_ERROR', 'binance', error);
    }
  }

  async getTickers(symbols?: string[]): Promise<{ [symbol: string]: CCXTTicker }> {
    try {
      this.ensureConnected();
      const tickers = await this.exchange.fetchTickers(symbols);

      // Cache prices for risk management
      Object.entries(tickers).forEach(([symbol, ticker]) => {
        this.lastPrices.set(symbol, ticker.last);
      });

      return tickers;

    } catch (error) {
      tradingLogger.error('Failed to fetch tickers', { symbols, error: error.message, component: 'live-trading' });
      throw new LiveTradingError('Failed to fetch tickers', 'TICKERS_ERROR', 'binance', error);
    }
  }

  async getOrderBook(symbol: string, limit?: number): Promise<CCXTOrderBook> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchOrderBook(symbol, limit);

    } catch (error) {
      tradingLogger.error('Failed to fetch order book', { symbol, error: error.message, component: 'live-trading' });
      throw new LiveTradingError(`Failed to fetch order book for ${symbol}`, 'ORDERBOOK_ERROR', 'binance', error);
    }
  }

  async getCandles(symbol: string, timeframe: string, since?: number, limit?: number): Promise<CCXTCandle[]> {
    try {
      this.ensureConnected();
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);

      return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      }));

    } catch (error) {
      tradingLogger.error('Failed to fetch candles', {
        symbol,
        timeframe,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to fetch candles for ${symbol}`, 'CANDLES_ERROR', 'binance', error);
    }
  }

  async getMarkets(): Promise<{ [symbol: string]: MarketInfo }> {
    try {
      this.ensureConnected();
      const markets = this.exchange.markets || {};

      const marketInfo: { [symbol: string]: MarketInfo } = {};

      Object.entries(markets).forEach(([symbol, market]) => {
        marketInfo[symbol] = {
          id: market.id,
          symbol: market.symbol,
          base: market.base,
          quote: market.quote,
          settle: market.settle,
          baseId: market.baseId,
          quoteId: market.quoteId,
          settleId: market.settleId,
          type: market.type,
          spot: market.spot,
          margin: market.margin,
          future: market.future,
          swap: market.swap,
          option: market.option,
          active: market.active,
          contract: market.contract,
          linear: market.linear,
          inverse: market.inverse,
          contractSize: market.contractSize,
          expiry: market.expiry,
          expiryDatetime: market.expiryDatetime,
          strike: market.strike,
          optionType: market.optionType,
          precision: market.precision,
          limits: market.limits,
          info: market.info
        };
      });

      return marketInfo;

    } catch (error) {
      tradingLogger.error('Failed to fetch markets', { error: error.message, component: 'live-trading' });
      throw new LiveTradingError('Failed to fetch markets', 'MARKETS_ERROR', 'binance', error);
    }
  }

  // Trading Operations
  async createOrder(params: LiveOrderParams): Promise<CCXTOrder> {
    try {
      this.ensureConnected();

      // Pre-trade risk validation
      const riskCheck = await this.checkPreTradeRisk(params);
      if (!riskCheck.approved) {
        throw new RiskManagementError(`Order rejected by risk management: ${riskCheck.reasons.join(', ')}`, riskCheck);
      }

      // Enforce cooldown period
      const now = Date.now();
      if (now - this.lastTradeTime < this.riskConfig.cooldownPeriod) {
        throw new RiskManagementError('Cooldown period not elapsed', { cooldown: this.riskConfig.cooldownPeriod });
      }

      // Prepare order parameters for CCXT
      const orderParams: any = {
        type: params.type,
        side: params.side,
        amount: params.amount,
        symbol: params.symbol
      };

      // Add price for limit orders
      if (params.type === 'limit' && params.price) {
        orderParams.price = params.price;
      }

      // Add additional parameters
      if (params.timeInForce) {
        orderParams.timeInForce = params.timeInForce;
      }

      if (params.reduceOnly) {
        orderParams.reduceOnly = params.reduceOnly;
      }

      if (params.postOnly) {
        orderParams.postOnly = params.postOnly;
      }

      if (params.clientOrderId) {
        orderParams.clientOrderId = params.clientOrderId;
      }

      // Execute the order
      const order = await this.exchange.createOrder(
        params.symbol,
        params.type,
        params.side,
        params.amount,
        params.price,
        params.params || {}
      );

      // Update trading statistics
      this.lastTradeTime = now;
      this.dailyTrades++;
      this.dailyVolume += params.amount * (params.price || this.lastPrices.get(params.symbol) || 0);

      tradingLogger.info('Order created successfully', {
        orderId: order.id,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        amount: params.amount,
        price: params.price,
        component: 'live-trading'
      });

      // Emit trading event
      this.emit('orderCreated', {
        type: LiveTradingEventType.ORDER_UPDATE,
        data: order,
        timestamp: Date.now(),
        accountId: 'live-account'
      } as LiveTradingEvent);

      return order;

    } catch (error) {
      tradingLogger.error('Failed to create order', {
        params,
        error: error.message,
        component: 'live-trading'
      });

      if (error instanceof RiskManagementError) {
        throw error;
      } else if (error.message.includes('insufficient')) {
        throw new InsufficientFundsError('Insufficient funds for order', error);
      } else if (error.message.includes('invalid')) {
        throw new InvalidOrderError('Invalid order parameters', error);
      } else {
        throw new LiveTradingError('Failed to create order', 'ORDER_ERROR', 'binance', error);
      }
    }
  }

  async cancelOrder(id: string, symbol: string): Promise<CCXTOrder> {
    try {
      this.ensureConnected();
      const order = await this.exchange.cancelOrder(id, symbol);

      tradingLogger.info('Order cancelled successfully', {
        orderId: id,
        symbol,
        component: 'live-trading'
      });

      return order;

    } catch (error) {
      tradingLogger.error('Failed to cancel order', {
        orderId: id,
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to cancel order ${id}`, 'CANCEL_ERROR', 'binance', error);
    }
  }

  async cancelAllOrders(symbol?: string): Promise<CCXTOrder[]> {
    try {
      this.ensureConnected();
      const orders = await this.exchange.cancelAllOrders(symbol);

      tradingLogger.info('All orders cancelled successfully', {
        symbol,
        count: orders.length,
        component: 'live-trading'
      });

      return orders;

    } catch (error) {
      tradingLogger.error('Failed to cancel all orders', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to cancel all orders', 'CANCEL_ALL_ERROR', 'binance', error);
    }
  }

  async getOrder(id: string, symbol: string): Promise<CCXTOrder> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchOrder(id, symbol);

    } catch (error) {
      tradingLogger.error('Failed to fetch order', {
        orderId: id,
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to fetch order ${id}`, 'FETCH_ORDER_ERROR', 'binance', error);
    }
  }

  async getOrders(symbol?: string, since?: number, limit?: number): Promise<CCXTOrder[]> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchOrders(symbol, since, limit);

    } catch (error) {
      tradingLogger.error('Failed to fetch orders', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to fetch orders', 'FETCH_ORDERS_ERROR', 'binance', error);
    }
  }

  async getOpenOrders(symbol?: string): Promise<CCXTOrder[]> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchOpenOrders(symbol);

    } catch (error) {
      tradingLogger.error('Failed to fetch open orders', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to fetch open orders', 'FETCH_OPEN_ORDERS_ERROR', 'binance', error);
    }
  }

  // Position Management
  async getPositions(symbols?: string[]): Promise<CCXTPosition[]> {
    try {
      this.ensureConnected();
      const positions = await this.exchange.fetchPositions(symbols);

      // Filter out zero positions
      return positions.filter(position => Math.abs(position.size) > 0);

    } catch (error) {
      tradingLogger.error('Failed to fetch positions', {
        symbols,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to fetch positions', 'FETCH_POSITIONS_ERROR', 'binance', error);
    }
  }

  async getPosition(symbol: string): Promise<CCXTPosition> {
    try {
      this.ensureConnected();
      const positions = await this.exchange.fetchPosition(symbol);
      return positions;

    } catch (error) {
      tradingLogger.error('Failed to fetch position', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to fetch position for ${symbol}`, 'FETCH_POSITION_ERROR', 'binance', error);
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      this.ensureConnected();

      if (leverage > this.riskConfig.maxLeverage) {
        throw new RiskManagementError(`Leverage ${leverage} exceeds maximum allowed ${this.riskConfig.maxLeverage}`);
      }

      await this.exchange.setLeverage(leverage, symbol);

      tradingLogger.info('Leverage set successfully', {
        symbol,
        leverage,
        component: 'live-trading'
      });

    } catch (error) {
      if (error instanceof RiskManagementError) {
        throw error;
      }

      tradingLogger.error('Failed to set leverage', {
        symbol,
        leverage,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to set leverage for ${symbol}`, 'SET_LEVERAGE_ERROR', 'binance', error);
    }
  }

  async setMarginMode(symbol: string, marginMode: 'cross' | 'isolated'): Promise<void> {
    try {
      this.ensureConnected();
      await this.exchange.setMarginMode(marginMode, symbol);

      tradingLogger.info('Margin mode set successfully', {
        symbol,
        marginMode,
        component: 'live-trading'
      });

    } catch (error) {
      tradingLogger.error('Failed to set margin mode', {
        symbol,
        marginMode,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError(`Failed to set margin mode for ${symbol}`, 'SET_MARGIN_MODE_ERROR', 'binance', error);
    }
  }

  // Trading History
  async getTrades(symbol?: string, since?: number, limit?: number): Promise<CCXTTrade[]> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchTrades(symbol || 'BTC/USDT', since, limit);

    } catch (error) {
      tradingLogger.error('Failed to fetch trades', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to fetch trades', 'FETCH_TRADES_ERROR', 'binance', error);
    }
  }

  async getMyTrades(symbol?: string, since?: number, limit?: number): Promise<CCXTTrade[]> {
    try {
      this.ensureConnected();
      return await this.exchange.fetchMyTrades(symbol, since, limit);

    } catch (error) {
      tradingLogger.error('Failed to fetch my trades', {
        symbol,
        error: error.message,
        component: 'live-trading'
      });
      throw new LiveTradingError('Failed to fetch my trades', 'FETCH_MY_TRADES_ERROR', 'binance', error);
    }
  }

  // Risk Management
  async checkPreTradeRisk(params: LiveOrderParams): Promise<{ approved: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    try {
      // Check if symbol is allowed
      if (this.riskConfig.allowedSymbols.length > 0 && !this.riskConfig.allowedSymbols.includes(params.symbol)) {
        reasons.push(`Symbol ${params.symbol} is not in allowed list`);
      }

      // Check if symbol is forbidden
      if (this.riskConfig.forbiddenSymbols.includes(params.symbol)) {
        reasons.push(`Symbol ${params.symbol} is forbidden`);
      }

      // Check position size
      const currentPrice = this.lastPrices.get(params.symbol) || params.price || 0;
      const orderValue = params.amount * currentPrice;

      if (orderValue > this.riskConfig.maxPositionSize) {
        reasons.push(`Order value ${orderValue.toFixed(2)} exceeds max position size ${this.riskConfig.maxPositionSize}`);
      }

      if (orderValue > this.riskConfig.maxOrderValue) {
        reasons.push(`Order value ${orderValue.toFixed(2)} exceeds max order value ${this.riskConfig.maxOrderValue}`);
      }

      // Check open positions limit
      const openPositions = await this.getPositions();
      if (openPositions.length >= this.riskConfig.maxOpenPositions) {
        reasons.push(`Maximum open positions limit reached (${this.riskConfig.maxOpenPositions})`);
      }

      // Check daily loss limit
      if (this.dailyPnl < -this.riskConfig.maxDailyLoss) {
        reasons.push(`Daily loss limit reached (-${this.riskConfig.maxDailyLoss})`);
      }

      // Check available balance
      const balance = await this.getBalance();
      const availableBalance = balance.free?.USDT || 0;

      if (orderValue > availableBalance * 0.95) { // Leave 5% buffer
        reasons.push(`Insufficient balance. Required: ${orderValue.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`);
      }

      return {
        approved: reasons.length === 0,
        reasons
      };

    } catch (error) {
      tradingLogger.error('Risk check failed', { error: error.message, component: 'live-trading' });
      return {
        approved: false,
        reasons: ['Risk check failed due to system error']
      };
    }
  }

  async getStats(): Promise<LiveTradingStats> {
    try {
      const trades = await this.getMyTrades(undefined, undefined, 100);
      const balance = await this.getBalance();

      let totalPnl = 0;
      let winningTrades = 0;
      let totalVolume = 0;
      let wins: number[] = [];
      let losses: number[] = [];

      trades.forEach(trade => {
        const pnl = trade.side === 'buy' ? -trade.cost : trade.cost;
        totalPnl += pnl;
        totalVolume += trade.cost;

        if (pnl > 0) {
          winningTrades++;
          wins.push(pnl);
        } else if (pnl < 0) {
          losses.push(Math.abs(pnl));
        }
      });

      const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
      const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;

      return {
        accountId: 'live-account',
        totalTrades: trades.length,
        winningTrades,
        losingTrades: trades.length - winningTrades,
        totalVolume,
        totalPnl,
        dailyPnl: this.dailyPnl,
        weeklyPnl: 0, // Would need historical data
        monthlyPnl: 0, // Would need historical data
        maxDrawdown: 0, // Would need historical equity curve
        currentDrawdown: 0,
        winRate: trades.length > 0 ? (winningTrades / trades.length) * 100 : 0,
        profitFactor,
        sharpeRatio: 0, // Would need returns analysis
        averageWin,
        averageLoss,
        largestWin: wins.length > 0 ? Math.max(...wins) : 0,
        largestLoss: losses.length > 0 ? Math.max(...losses) : 0,
        tradingDays: 1, // Simplified
        lastTradeAt: trades.length > 0 ? new Date(trades[0].timestamp) : undefined,
        updatedAt: new Date()
      };

    } catch (error) {
      tradingLogger.error('Failed to calculate stats', { error: error.message, component: 'live-trading' });
      throw new LiveTradingError('Failed to calculate trading statistics', 'STATS_ERROR', 'binance', error);
    }
  }

  // WebSocket Subscriptions (if supported by CCXT version)
  async watchTicker(symbol: string, callback: (ticker: CCXTTicker) => void): Promise<void> {
    if (!this.wsExchange || !this.wsExchange.watchTicker) {
      throw new LiveTradingError('WebSocket ticker watching not supported', 'WS_NOT_SUPPORTED');
    }

    try {
      this.watchedSymbols.add(symbol);
      const subscription = await this.wsExchange.watchTicker(symbol);
      this.subscriptions.set(`ticker:${symbol}`, subscription);

      // Set up callback
      setInterval(async () => {
        try {
          const ticker = await this.wsExchange!.watchTicker(symbol);
          callback(ticker);
        } catch (error) {
          tradingLogger.error('WebSocket ticker error', { symbol, error: error.message, component: 'live-trading' });
        }
      }, 1000);

    } catch (error) {
      tradingLogger.error('Failed to watch ticker', { symbol, error: error.message, component: 'live-trading' });
      throw new LiveTradingError(`Failed to watch ticker for ${symbol}`, 'WS_TICKER_ERROR', 'binance', error);
    }
  }

  async watchOrderBook(symbol: string, callback: (orderbook: CCXTOrderBook) => void): Promise<void> {
    if (!this.wsExchange || !this.wsExchange.watchOrderBook) {
      throw new LiveTradingError('WebSocket order book watching not supported', 'WS_NOT_SUPPORTED');
    }

    try {
      this.watchedSymbols.add(symbol);
      // Implementation would depend on CCXT WebSocket capabilities
      throw new LiveTradingError('Order book watching not yet implemented', 'NOT_IMPLEMENTED');

    } catch (error) {
      tradingLogger.error('Failed to watch order book', { symbol, error: error.message, component: 'live-trading' });
      throw new LiveTradingError(`Failed to watch order book for ${symbol}`, 'WS_ORDERBOOK_ERROR', 'binance', error);
    }
  }

  async watchTrades(symbol: string, callback: (trades: CCXTTrade[]) => void): Promise<void> {
    throw new LiveTradingError('Trade watching not yet implemented', 'NOT_IMPLEMENTED');
  }

  async watchOrders(callback: (orders: CCXTOrder[]) => void): Promise<void> {
    throw new LiveTradingError('Order watching not yet implemented', 'NOT_IMPLEMENTED');
  }

  async watchPositions(callback: (positions: CCXTPosition[]) => void): Promise<void> {
    throw new LiveTradingError('Position watching not yet implemented', 'NOT_IMPLEMENTED');
  }

  async watchBalance(callback: (balance: CCXTBalance) => void): Promise<void> {
    throw new LiveTradingError('Balance watching not yet implemented', 'NOT_IMPLEMENTED');
  }

  // Unsubscribe
  async unwatch(symbol?: string, channel?: string): Promise<void> {
    if (symbol && channel) {
      const key = `${channel}:${symbol}`;
      this.subscriptions.delete(key);
      this.watchedSymbols.delete(symbol);
    }
  }

  async unwatchAll(): Promise<void> {
    this.subscriptions.clear();
    this.watchedSymbols.clear();
  }

  // Private helper methods
  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new ExchangeConnectionError('Not connected to exchange', 'binance');
    }
  }

  // Reconnection logic
  private async attemptReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      tradingLogger.error('Max reconnection attempts reached', { component: 'live-trading' });
      return;
    }

    this.reconnectAttempts++;

    try {
      tradingLogger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
        component: 'live-trading'
      });

      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      await this.connect();

    } catch (error) {
      tradingLogger.error('Reconnection failed', {
        attempt: this.reconnectAttempts,
        error: error.message,
        component: 'live-trading'
      });

      // Exponential backoff
      this.reconnectDelay *= 2;
      await this.attemptReconnection();
    }
  }
}

// Create and export singleton instance
export const binanceLiveTradingService = new BinanceLiveTradingService();