/**
 * Simplified Paper Trading Service for TypeScript compatibility
 */

import { EventEmitter } from 'events';
import {
  PaperTradingAccount,
  PaperRiskSettings,
  PaperAccountStatistics,
  PaperPosition,
  PaperOrder,
  PaperTrade,
  PaperPortfolio,
  PaperTradingSignal,
  PaperTradingService as IPaperTradingService
} from '@/types/paper-trading';
import { apiLogger, tradingLogger } from '@/services/logger';
import { v4 as uuidv4 } from 'uuid';

export class PaperTradingService extends EventEmitter implements IPaperTradingService {
  private accounts = new Map<string, PaperTradingAccount>();
  private positions = new Map<string, PaperPosition[]>();
  private orders = new Map<string, PaperOrder[]>();
  private trades = new Map<string, PaperTrade[]>();

  constructor() {
    super();
    apiLogger.info('Paper Trading Service initialized');
  }

  /**
   * Create a new paper trading account
   */
  async createAccount(userId: string, config: Partial<PaperTradingAccount>): Promise<PaperTradingAccount> {
    const accountId = uuidv4();
    const now = new Date();

    const defaultRiskSettings: PaperRiskSettings = {
      maxDailyLoss: 1000,
      maxDailyLossPercentage: 5,
      maxPositionSize: 10000,
      maxPositionSizePercentage: 10,
      maxOpenPositions: 10,
      allowedSymbols: [],
      blockedSymbols: [],
      maxLeverage: 10,
      stopLossRequired: false,
      takeProfitRequired: false,
      riskPerTrade: 2,
      dailyTradingLimit: 100,
      isEnabled: true
    };

    const defaultStatistics: PaperAccountStatistics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      maxDrawdownPercentage: 0,
      averageHoldingTime: 0,
      totalCommissions: 0,
      totalVolume: 0,
      activeStrategies: 0,
      tradingDays: 0
    };

    const account: PaperTradingAccount = {
      id: accountId,
      userId,
      name: config.name || `Paper Account ${accountId.slice(0, 8)}`,
      initialBalance: config.initialBalance || 10000,
      currentBalance: config.initialBalance || 10000,
      availableBalance: config.initialBalance || 10000,
      totalEquity: config.initialBalance || 10000,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      marginUsed: 0,
      marginAvailable: config.initialBalance || 10000,
      marginLevel: 100,
      currency: config.currency || 'USD',
      leverage: config.leverage || 1,
      maxLeverage: config.maxLeverage || 10,
      isActive: true,
      riskSettings: { ...defaultRiskSettings, ...config.riskSettings },
      statistics: defaultStatistics,
      createdAt: now,
      updatedAt: now
    };

    this.accounts.set(accountId, account);
    this.positions.set(accountId, []);
    this.orders.set(accountId, []);
    this.trades.set(accountId, []);

    tradingLogger.info('Paper trading account created', {
      accountId,
      userId,
      initialBalance: account.initialBalance
    });

    return account;
  }

  /**
   * Get account by ID
   */
  async getAccount(accountId: string): Promise<PaperTradingAccount | null> {
    return this.accounts.get(accountId) || null;
  }

  /**
   * Update account
   */
  async updateAccount(accountId: string, updates: Partial<PaperTradingAccount>): Promise<PaperTradingAccount> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const updatedAccount = { ...account, ...updates, updatedAt: new Date() };
    this.accounts.set(accountId, updatedAccount);

    return updatedAccount;
  }

  /**
   * Delete account
   */
  async deleteAccount(accountId: string): Promise<boolean> {
    const deleted = this.accounts.delete(accountId);
    if (deleted) {
      this.positions.delete(accountId);
      this.orders.delete(accountId);
      this.trades.delete(accountId);
    }
    return deleted;
  }

  /**
   * Get user accounts
   */
  async getUserAccounts(userId: string, filters?: any): Promise<PaperTradingAccount[]> {
    const accounts = Array.from(this.accounts.values()).filter(account => account.userId === userId);

    if (filters?.isActive !== undefined) {
      return accounts.filter(account => account.isActive === filters.isActive);
    }

    return accounts;
  }

  /**
   * Create order
   */
  async createOrder(accountId: string, orderData: Partial<PaperOrder>): Promise<PaperOrder> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const orderId = uuidv4();
    const now = new Date();

    const order: PaperOrder = {
      id: orderId,
      accountId,
      symbol: orderData.symbol!,
      side: orderData.side!,
      type: orderData.type!,
      timeInForce: orderData.timeInForce || 'GTC',
      quantity: orderData.quantity!,
      price: orderData.price,
      stopPrice: orderData.stopPrice,
      filledQuantity: 0,
      remainingQuantity: orderData.quantity!,
      status: 'NEW',
      clientOrderId: orderData.clientOrderId,
      reduceOnly: orderData.reduceOnly || false,
      closePosition: orderData.closePosition || false,
      commission: 0,
      commissionAsset: 'USD',
      slippage: 0,
      createdAt: now,
      updatedAt: now,
      strategyId: orderData.strategyId,
      strategyName: orderData.strategyName
    };

    const accountOrders = this.orders.get(accountId) || [];
    accountOrders.push(order);
    this.orders.set(accountId, accountOrders);

    tradingLogger.info('Paper order created', {
      orderId: order.id,
      accountId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity
    });

    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(accountId: string, orderId: string): Promise<boolean> {
    const accountOrders = this.orders.get(accountId) || [];
    const order = accountOrders.find(o => o.id === orderId);

    if (!order || order.status === 'FILLED' || order.status === 'CANCELED') {
      return false;
    }

    order.status = 'CANCELED';
    order.canceledAt = new Date();
    order.updatedAt = new Date();

    tradingLogger.info('Paper order canceled', {
      orderId,
      accountId,
      symbol: order.symbol
    });

    return true;
  }

  /**
   * Get order
   */
  async getOrder(orderId: string): Promise<PaperOrder | null> {
    for (const orders of this.orders.values()) {
      const order = orders.find(o => o.id === orderId);
      if (order) return order;
    }
    return null;
  }

  /**
   * Get orders
   */
  async getOrders(accountId: string, filters?: any): Promise<PaperOrder[]> {
    const orders = this.orders.get(accountId) || [];

    if (filters?.symbol) {
      return orders.filter(order => order.symbol === filters.symbol);
    }

    if (filters?.status) {
      return orders.filter(order => order.status === filters.status);
    }

    return orders;
  }

  /**
   * Get positions
   */
  async getPositions(accountId: string, filters?: any): Promise<PaperPosition[]> {
    const positions = this.positions.get(accountId) || [];

    if (filters?.symbol) {
      return positions.filter(pos => pos.symbol === filters.symbol);
    }

    if (filters?.status) {
      return positions.filter(pos => pos.status === filters.status);
    }

    return positions;
  }

  /**
   * Close position
   */
  async closePosition(accountId: string, positionId: string): Promise<boolean> {
    const positions = this.positions.get(accountId) || [];
    const position = positions.find(p => p.id === positionId);

    if (!position || position.status === 'CLOSED') {
      return false;
    }

    position.status = 'CLOSED';
    position.lastUpdateTime = new Date();

    tradingLogger.info('Paper position closed', {
      positionId,
      accountId,
      symbol: position.symbol
    });

    return true;
  }

  /**
   * Update position
   */
  async updatePosition(positionId: string, marketPrice: number): Promise<PaperPosition> {
    for (const positions of this.positions.values()) {
      const position = positions.find(p => p.id === positionId);
      if (position) {
        position.currentPrice = marketPrice;
        position.markPrice = marketPrice;

        // Calculate P&L
        if (position.side === 'LONG') {
          position.unrealizedPnL = (marketPrice - position.entryPrice) * position.size;
        } else {
          position.unrealizedPnL = (position.entryPrice - marketPrice) * position.size;
        }

        position.unrealizedPnLPercentage = (position.unrealizedPnL / (position.entryPrice * position.size)) * 100;
        position.lastUpdateTime = new Date();

        return position;
      }
    }
    throw new Error('Position not found');
  }

  /**
   * Execute order
   */
  async executeOrder(order: PaperOrder, marketPrice: number): Promise<PaperTrade[]> {
    const commission = order.quantity * marketPrice * 0.001; // 0.1% commission

    const trade: PaperTrade = {
      id: uuidv4(),
      accountId: order.accountId,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: marketPrice,
      commission,
      commissionAsset: 'USD',
      realizedPnL: 0,
      quoteQuantity: order.quantity * marketPrice,
      timestamp: new Date(),
      isMaker: false,
      strategyId: order.strategyId,
      strategyName: order.strategyName,
      metadata: {}
    };

    const accountTrades = this.trades.get(order.accountId) || [];
    accountTrades.push(trade);
    this.trades.set(order.accountId, accountTrades);

    // Update order status
    order.status = 'FILLED';
    order.filledQuantity = order.quantity;
    order.remainingQuantity = 0;
    order.averagePrice = marketPrice;
    order.commission = commission;
    order.filledAt = new Date();
    order.updatedAt = new Date();

    return [trade];
  }

  /**
   * Process signal
   */
  async processSignal(accountId: string, signal: PaperTradingSignal): Promise<PaperOrder | null> {
    try {
      const orderData: Partial<PaperOrder> = {
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'BUY' : 'SELL',
        type: signal.type || 'MARKET',
        quantity: signal.quantity || 1,
        price: signal.price,
        strategyId: signal.strategyId,
        strategyName: signal.strategyName
      };

      return await this.createOrder(accountId, orderData);
    } catch (error) {
      tradingLogger.error('Failed to process signal', error as Error, {
        accountId,
        strategyId: signal.strategyId,
        symbol: signal.symbol
      });
      return null;
    }
  }

  /**
   * Calculate P&L
   */
  async calculatePnL(position: PaperPosition, currentPrice: number): Promise<number> {
    if (position.side === 'LONG') {
      return (currentPrice - position.entryPrice) * position.size;
    } else {
      return (position.entryPrice - currentPrice) * position.size;
    }
  }

  /**
   * Get portfolio
   */
  async getPortfolio(accountId: string): Promise<PaperPortfolio> {
    const account = this.accounts.get(accountId);
    const positions = this.positions.get(accountId) || [];
    const openOrders = (this.orders.get(accountId) || []).filter(o => o.status === 'NEW' || o.status === 'PARTIALLY_FILLED');

    if (!account) {
      throw new Error('Account not found');
    }

    const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const marginUsed = positions.reduce((sum, pos) => sum + pos.margin, 0);

    const portfolio: PaperPortfolio = {
      accountId,
      totalValue: account.currentBalance + totalUnrealizedPnL,
      totalEquity: account.totalEquity,
      availableBalance: account.availableBalance,
      unrealizedPnL: totalUnrealizedPnL,
      realizedPnL: account.realizedPnL,
      marginUsed,
      marginLevel: marginUsed > 0 ? (account.currentBalance / marginUsed) * 100 : 100,
      positions,
      openOrders,
      dailyPnL: 0, // TODO: Calculate daily P&L
      dailyPnLPercentage: 0,
      lastUpdateTime: new Date()
    };

    return portfolio;
  }

  /**
   * Update portfolio value
   */
  async updatePortfolioValue(accountId: string): Promise<PaperPortfolio> {
    // For now, just return the current portfolio
    return this.getPortfolio(accountId);
  }

  /**
   * Calculate margin level
   */
  async calculateMarginLevel(accountId: string): Promise<number> {
    const account = this.accounts.get(accountId);
    const positions = this.positions.get(accountId) || [];

    if (!account) {
      throw new Error('Account not found');
    }

    const marginUsed = positions.reduce((sum, pos) => sum + pos.margin, 0);
    return marginUsed > 0 ? (account.currentBalance / marginUsed) * 100 : 100;
  }

  /**
   * Get performance
   */
  async getPerformance(accountId: string): Promise<PaperAccountStatistics> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    return account.statistics;
  }

  /**
   * Get trades
   */
  async getTrades(accountId: string, filters?: any): Promise<PaperTrade[]> {
    const trades = this.trades.get(accountId) || [];

    if (filters?.symbol) {
      return trades.filter(trade => trade.symbol === filters.symbol);
    }

    if (filters?.strategyId) {
      return trades.filter(trade => trade.strategyId === filters.strategyId);
    }

    return trades;
  }

  /**
   * Get system statistics
   */
  async getStatistics(): Promise<any> {
    return {
      totalAccounts: this.accounts.size,
      activeAccounts: Array.from(this.accounts.values()).filter(a => a.isActive).length,
      totalTrades24h: 0,
      totalVolume24h: 0,
      averageWinRate: 0,
      topPerformers: [],
      systemLoad: {
        activeOrders: 0,
        openPositions: 0,
        strategiesRunning: 0
      }
    };
  }
}