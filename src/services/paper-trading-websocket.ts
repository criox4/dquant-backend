/**
 * Paper Trading WebSocket Service - Real-time Trading Updates
 * Provides live updates for paper trading activities, portfolio changes, and strategy signals
 */

import { EventEmitter } from 'events';
import { broadcastToRoom, broadcastToUser } from '@/websocket/server';
import {
  PaperTradingEvent,
  PaperAccountUpdateEvent,
  PaperOrderUpdateEvent,
  PaperPositionUpdateEvent,
  PaperTradeExecutionEvent,
  PaperStrategySignalEvent,
  PaperTradingAccount,
  PaperOrder,
  PaperPosition,
  PaperTrade,
  PaperPortfolio
} from '@/types/paper-trading';
import { WebSocketEvent } from '@/types/common';
import { tradingLogger, websocketLogger } from '@/services/logger';

export class PaperTradingWebSocketService extends EventEmitter {
  private subscribedUsers = new Map<string, Set<string>>(); // userId -> Set of accountIds
  private accountSubscribers = new Map<string, Set<string>>(); // accountId -> Set of userIds
  private strategySubscribers = new Map<string, Set<string>>(); // strategyId -> Set of userIds

  constructor() {
    super();
    tradingLogger.info('Paper Trading WebSocket Service initialized');
  }

  /**
   * Subscribe user to paper trading updates for specific account
   */
  async subscribeToAccount(userId: string, accountId: string): Promise<void> {
    // Add user to account subscriptions
    if (!this.subscribedUsers.has(userId)) {
      this.subscribedUsers.set(userId, new Set());
    }
    this.subscribedUsers.get(userId)!.add(accountId);

    // Add account to user subscriptions
    if (!this.accountSubscribers.has(accountId)) {
      this.accountSubscribers.set(accountId, new Set());
    }
    this.accountSubscribers.get(accountId)!.add(userId);

    websocketLogger.info('User subscribed to paper trading account', {
      userId,
      accountId,
      totalAccountSubscribers: this.accountSubscribers.get(accountId)!.size
    });

    // Send subscription confirmation
    await broadcastToUser(userId, {
      event: 'paper_trading_subscription_confirmed',
      data: {
        accountId,
        subscriptionType: 'paper_trading_account',
        message: 'Successfully subscribed to paper trading updates'
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Unsubscribe user from paper trading updates
   */
  async unsubscribeFromAccount(userId: string, accountId: string): Promise<void> {
    // Remove from user subscriptions
    const userAccounts = this.subscribedUsers.get(userId);
    if (userAccounts) {
      userAccounts.delete(accountId);
      if (userAccounts.size === 0) {
        this.subscribedUsers.delete(userId);
      }
    }

    // Remove from account subscriptions
    const accountUsers = this.accountSubscribers.get(accountId);
    if (accountUsers) {
      accountUsers.delete(userId);
      if (accountUsers.size === 0) {
        this.accountSubscribers.delete(accountId);
      }
    }

    websocketLogger.info('User unsubscribed from paper trading account', {
      userId,
      accountId
    });
  }

  /**
   * Subscribe to strategy-specific updates
   */
  async subscribeToStrategy(userId: string, strategyId: string): Promise<void> {
    if (!this.strategySubscribers.has(strategyId)) {
      this.strategySubscribers.set(strategyId, new Set());
    }
    this.strategySubscribers.get(strategyId)!.add(userId);

    websocketLogger.info('User subscribed to strategy updates', {
      userId,
      strategyId,
      totalStrategySubscribers: this.strategySubscribers.get(strategyId)!.size
    });

    await broadcastToUser(userId, {
      event: 'strategy_subscription_confirmed',
      data: {
        strategyId,
        subscriptionType: 'strategy_updates',
        message: 'Successfully subscribed to strategy updates'
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast account balance and equity updates
   */
  async broadcastAccountUpdate(accountId: string, account: PaperTradingAccount): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const updateEvent: PaperAccountUpdateEvent = {
      type: 'ACCOUNT_UPDATE',
      accountId,
      data: {
        balance: account.currentBalance,
        equity: account.totalEquity,
        unrealizedPnL: account.unrealizedPnL,
        marginUsed: account.marginUsed,
        marginLevel: account.marginLevel
      },
      timestamp: new Date()
    };

    const message: WebSocketEvent = {
      event: 'paper_account_update',
      data: updateEvent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to account-specific room
    await broadcastToRoom(`paper_account_${accountId}`, message);

    tradingLogger.debug('Broadcasted account update', {
      accountId,
      subscriberCount: subscribers.size,
      balance: account.currentBalance,
      equity: account.totalEquity
    });
  }

  /**
   * Broadcast order status updates
   */
  async broadcastOrderUpdate(accountId: string, order: PaperOrder): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const orderEvent: PaperOrderUpdateEvent = {
      type: 'ORDER_UPDATE',
      accountId,
      data: {
        order,
        executionReport: {
          orderId: order.id,
          symbol: order.symbol,
          side: order.side,
          orderType: order.type,
          timeInForce: order.timeInForce,
          quantity: order.quantity,
          price: order.price || 0,
          stopPrice: order.stopPrice,
          executionType: order.status === 'FILLED' ? 'TRADE' : 'NEW',
          orderStatus: order.status,
          filledQuantity: order.filledQuantity,
          filledPrice: order.averagePrice || 0,
          commission: order.commission,
          commissionAsset: order.commissionAsset,
          timestamp: new Date()
        }
      },
      timestamp: new Date()
    };

    const message: WebSocketEvent = {
      event: 'paper_order_update',
      data: orderEvent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to account-specific room
    await broadcastToRoom(`paper_account_${accountId}`, message);

    tradingLogger.info('Broadcasted order update', {
      accountId,
      orderId: order.id,
      symbol: order.symbol,
      status: order.status,
      subscriberCount: subscribers.size
    });
  }

  /**
   * Broadcast position updates with P&L changes
   */
  async broadcastPositionUpdate(
    accountId: string,
    position: PaperPosition,
    priceChange: number,
    pnlChange: number
  ): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const positionEvent: PaperPositionUpdateEvent = {
      type: 'POSITION_UPDATE',
      accountId,
      data: {
        position,
        priceChange,
        pnlChange
      },
      timestamp: new Date()
    };

    const message: WebSocketEvent = {
      event: 'paper_position_update',
      data: positionEvent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to account-specific room
    await broadcastToRoom(`paper_account_${accountId}`, message);

    tradingLogger.debug('Broadcasted position update', {
      accountId,
      positionId: position.id,
      symbol: position.symbol,
      unrealizedPnL: position.unrealizedPnL,
      pnlChange,
      subscriberCount: subscribers.size
    });
  }

  /**
   * Broadcast trade execution events
   */
  async broadcastTradeExecution(
    accountId: string,
    trade: PaperTrade,
    position?: PaperPosition,
    newBalance?: number
  ): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const tradeEvent: PaperTradeExecutionEvent = {
      type: 'TRADE_EXECUTION',
      accountId,
      data: {
        trade,
        position,
        newBalance: newBalance || 0,
        realizedPnL: trade.realizedPnL
      },
      timestamp: new Date()
    };

    const message: WebSocketEvent = {
      event: 'paper_trade_execution',
      data: tradeEvent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to account-specific room
    await broadcastToRoom(`paper_account_${accountId}`, message);

    tradingLogger.info('Broadcasted trade execution', {
      accountId,
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      realizedPnL: trade.realizedPnL,
      subscriberCount: subscribers.size
    });
  }

  /**
   * Broadcast strategy signal events
   */
  async broadcastStrategySignal(
    strategyId: string,
    accountId: string,
    signal: any,
    executed: boolean,
    rejectionReason?: string
  ): Promise<void> {
    const strategySubscribers = this.strategySubscribers.get(strategyId);
    const accountSubscribers = this.accountSubscribers.get(accountId);

    const allSubscribers = new Set([
      ...(strategySubscribers || []),
      ...(accountSubscribers || [])
    ]);

    if (allSubscribers.size === 0) return;

    const signalEvent: PaperStrategySignalEvent = {
      type: 'STRATEGY_SIGNAL',
      accountId,
      data: {
        signal,
        executed,
        rejectionReason
      },
      timestamp: new Date()
    };

    const message: WebSocketEvent = {
      event: 'paper_strategy_signal',
      data: signalEvent,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all relevant subscribers
    for (const userId of allSubscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to strategy-specific room
    await broadcastToRoom(`strategy_${strategyId}`, message);

    tradingLogger.info('Broadcasted strategy signal', {
      strategyId,
      accountId,
      executed,
      rejectionReason,
      subscriberCount: allSubscribers.size
    });
  }

  /**
   * Broadcast portfolio summary updates
   */
  async broadcastPortfolioUpdate(accountId: string, portfolio: PaperPortfolio): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const message: WebSocketEvent = {
      event: 'paper_portfolio_update',
      data: {
        accountId,
        portfolio: {
          totalValue: portfolio.totalValue,
          totalEquity: portfolio.totalEquity,
          availableBalance: portfolio.availableBalance,
          unrealizedPnL: portfolio.unrealizedPnL,
          realizedPnL: portfolio.realizedPnL,
          marginUsed: portfolio.marginUsed,
          marginLevel: portfolio.marginLevel,
          positionCount: portfolio.positions.length,
          openOrderCount: portfolio.openOrders.length,
          dailyPnL: portfolio.dailyPnL,
          dailyPnLPercentage: portfolio.dailyPnLPercentage,
          lastUpdateTime: portfolio.lastUpdateTime
        }
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    // Also broadcast to account-specific room
    await broadcastToRoom(`paper_account_${accountId}`, message);

    tradingLogger.debug('Broadcasted portfolio update', {
      accountId,
      totalValue: portfolio.totalValue,
      unrealizedPnL: portfolio.unrealizedPnL,
      subscriberCount: subscribers.size
    });
  }

  /**
   * Broadcast market price updates affecting positions
   */
  async broadcastMarketUpdate(symbol: string, price: number, change24h: number): Promise<void> {
    // Find all accounts with positions in this symbol
    const affectedAccounts = new Set<string>();

    // This would typically query the database for positions
    // For now, we'll broadcast to all subscribers of market data
    const message: WebSocketEvent = {
      event: 'paper_market_update',
      data: {
        symbol,
        price,
        change24h,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to symbol-specific room
    await broadcastToRoom(`market_${symbol}`, message);

    tradingLogger.debug('Broadcasted market update', {
      symbol,
      price,
      change24h
    });
  }

  /**
   * Send real-time performance metrics
   */
  async broadcastPerformanceUpdate(
    accountId: string,
    metrics: {
      dailyPnL: number;
      totalPnL: number;
      winRate: number;
      totalTrades: number;
      currentDrawdown: number;
    }
  ): Promise<void> {
    const subscribers = this.accountSubscribers.get(accountId);
    if (!subscribers || subscribers.size === 0) return;

    const message: WebSocketEvent = {
      event: 'paper_performance_update',
      data: {
        accountId,
        metrics,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to subscribers
    for (const userId of subscribers) {
      await broadcastToUser(userId, message);
    }

    tradingLogger.debug('Broadcasted performance update', {
      accountId,
      dailyPnL: metrics.dailyPnL,
      totalTrades: metrics.totalTrades,
      subscriberCount: subscribers.size
    });
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats(): {
    totalUserSubscriptions: number;
    totalAccountSubscriptions: number;
    totalStrategySubscriptions: number;
    mostSubscribedAccount: { accountId: string; subscribers: number } | null;
    mostSubscribedStrategy: { strategyId: string; subscribers: number } | null;
  } {
    let mostSubscribedAccount = null;
    let maxAccountSubscribers = 0;

    for (const [accountId, subscribers] of this.accountSubscribers) {
      if (subscribers.size > maxAccountSubscribers) {
        maxAccountSubscribers = subscribers.size;
        mostSubscribedAccount = { accountId, subscribers: subscribers.size };
      }
    }

    let mostSubscribedStrategy = null;
    let maxStrategySubscribers = 0;

    for (const [strategyId, subscribers] of this.strategySubscribers) {
      if (subscribers.size > maxStrategySubscribers) {
        maxStrategySubscribers = subscribers.size;
        mostSubscribedStrategy = { strategyId, subscribers: subscribers.size };
      }
    }

    return {
      totalUserSubscriptions: this.subscribedUsers.size,
      totalAccountSubscriptions: this.accountSubscribers.size,
      totalStrategySubscriptions: this.strategySubscribers.size,
      mostSubscribedAccount,
      mostSubscribedStrategy
    };
  }

  /**
   * Cleanup inactive subscriptions
   */
  cleanup(): void {
    // Remove empty subscription sets
    for (const [userId, accounts] of this.subscribedUsers) {
      if (accounts.size === 0) {
        this.subscribedUsers.delete(userId);
      }
    }

    for (const [accountId, users] of this.accountSubscribers) {
      if (users.size === 0) {
        this.accountSubscribers.delete(accountId);
      }
    }

    for (const [strategyId, users] of this.strategySubscribers) {
      if (users.size === 0) {
        this.strategySubscribers.delete(strategyId);
      }
    }

    tradingLogger.debug('Cleaned up paper trading WebSocket subscriptions');
  }
}

// Singleton instance
export const paperTradingWebSocket = new PaperTradingWebSocketService();