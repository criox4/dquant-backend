/**
 * Performance Analytics Demo - Test and demonstration script
 * Shows comprehensive performance analytics capabilities
 */

import { performanceAnalyticsService } from '@/services/performance-analytics';
import { prisma } from '@/config/database';
import { tradingLogger } from '@/services/logger';

export async function demonstratePerformanceAnalytics() {
  try {
    tradingLogger.info('🚀 Starting Performance Analytics Demonstration');

    // Find an existing paper trading account for demo
    const account = await prisma.paperTradingAccount.findFirst({
      where: { isActive: true },
      include: { positions: true }
    });

    if (!account) {
      tradingLogger.warn('No active paper trading account found for demo');
      return;
    }

    const accountId = account.accountId;
    tradingLogger.info(`📊 Analyzing account: ${accountId}`);

    // 1. Calculate comprehensive performance metrics
    console.log('\n=== PERFORMANCE METRICS ===');
    const metrics = await performanceAnalyticsService.calculatePerformanceMetrics(accountId);

    console.log(`💰 Total Return: $${metrics.totalReturn.toFixed(2)} (${metrics.totalReturnPercentage.toFixed(2)}%)`);
    console.log(`📈 Annualized Return: ${(metrics.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`⚡ Sharpe Ratio: ${metrics.sharpeRatio.toFixed(3)}`);
    console.log(`📉 Max Drawdown: ${(metrics.maximumDrawdownPercentage).toFixed(2)}%`);
    console.log(`🎯 Win Rate: ${(metrics.winRate * 100).toFixed(1)}%`);
    console.log(`🔢 Total Trades: ${metrics.totalTrades}`);
    console.log(`💎 Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
    console.log(`🎲 Kelly %: ${(metrics.kelly * 100).toFixed(1)}%`);
    console.log(`📊 Volatility: ${(metrics.volatility * 100).toFixed(2)}%`);

    // 2. Calculate risk metrics
    console.log('\n=== RISK METRICS ===');
    const riskMetrics = await performanceAnalyticsService.calculateRiskMetrics(accountId);

    console.log(`📉 Current Drawdown: ${(riskMetrics.currentDrawdown * 100).toFixed(2)}%`);
    console.log(`📊 Sortino Ratio: ${riskMetrics.sortinRatio?.toFixed(3) || 'N/A'}`);
    console.log(`💰 VaR (95%): ${riskMetrics.var95.toFixed(4)}`);
    console.log(`💸 CVaR (95%): ${riskMetrics.cvar95.toFixed(4)}`);
    console.log(`📊 Downward Volatility: ${(riskMetrics.downwardVolatility * 100).toFixed(2)}%`);

    // 3. Generate equity curve
    console.log('\n=== EQUITY CURVE ANALYSIS ===');
    const equityCurve = await performanceAnalyticsService.generateEquityCurve(accountId);

    if (equityCurve.length > 0) {
      const startEquity = equityCurve[0]?.equity || 0;
      const endEquity = equityCurve[equityCurve.length - 1]?.equity || 0;
      const maxEquity = Math.max(...equityCurve.map(p => p.equity));
      const minDrawdown = Math.min(...equityCurve.map(p => p.drawdown));

      console.log(`📈 Equity Journey: $${startEquity.toFixed(2)} → $${endEquity.toFixed(2)}`);
      console.log(`🏔️ Peak Equity: $${maxEquity.toFixed(2)}`);
      console.log(`🕳️ Worst Drawdown: $${minDrawdown.toFixed(2)}`);
      console.log(`📊 Equity Points: ${equityCurve.length}`);
    }

    // 4. Generate drawdown curve
    console.log('\n=== DRAWDOWN ANALYSIS ===');
    const drawdownCurve = await performanceAnalyticsService.generateDrawdownCurve(accountId);

    if (drawdownCurve.length > 0) {
      const maxDays = Math.max(...drawdownCurve.map(d => d.daysSinceHigh));
      const currentDays = drawdownCurve[drawdownCurve.length - 1]?.daysSinceHigh || 0;
      const newHighs = drawdownCurve.filter(d => d.isNewHigh).length;

      console.log(`📉 Max Days in Drawdown: ${maxDays}`);
      console.log(`📅 Current Days Since High: ${currentDays}`);
      console.log(`🎯 New Highs: ${newHighs}`);
    }

    // 5. Calculate rolling metrics
    console.log('\n=== ROLLING METRICS (30-DAY) ===');
    const rollingMetrics = await performanceAnalyticsService.calculateRollingMetrics(accountId, 30);

    if (rollingMetrics.length > 0) {
      const latest = rollingMetrics[rollingMetrics.length - 1];
      if (latest) {
        console.log(`📊 Latest 30-day Performance:`);
        console.log(`  💰 Returns: $${latest.returns.toFixed(2)}`);
        console.log(`  📈 Sharpe: ${latest.sharpeRatio.toFixed(3)}`);
        console.log(`  📉 Max DD: $${latest.maxDrawdown.toFixed(2)}`);
        console.log(`  🎯 Win Rate: ${(latest.winRate * 100).toFixed(1)}%`);
        console.log(`  📊 Volatility: ${(latest.volatility * 100).toFixed(2)}%`);
      }
    }

    // 6. Check performance alerts
    console.log('\n=== PERFORMANCE ALERTS ===');
    const alerts = await performanceAnalyticsService.checkPerformanceAlerts(accountId);

    if (alerts.length > 0) {
      console.log(`🚨 Active Alerts: ${alerts.length}`);
      alerts.forEach(alert => {
        const severity = alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : '🔵';
        console.log(`  ${severity} ${alert.title}: ${alert.message}`);
      });
    } else {
      console.log(`✅ No active alerts - performance within acceptable ranges`);
    }

    // 7. Start real-time analytics demo
    console.log('\n=== REAL-TIME ANALYTICS ===');
    console.log('🔄 Starting real-time analytics for 10 seconds...');

    await performanceAnalyticsService.startRealTimeAnalytics(accountId);

    // Listen to analytics updates
    performanceAnalyticsService.on('analyticsUpdate', (event) => {
      console.log(`📊 Real-time update: ${event.type} for ${event.accountId}`);
    });

    // Stop after 10 seconds
    setTimeout(async () => {
      await performanceAnalyticsService.stopRealTimeAnalytics(accountId);
      console.log('⏹️ Real-time analytics stopped');
    }, 10000);

    // 8. Performance summary
    console.log('\n=== SUMMARY DASHBOARD ===');
    const summary = {
      account: {
        id: accountId,
        balance: `$${parseFloat(account.currentBalance.toString()).toFixed(2)}`,
        pnl: `$${parseFloat(account.totalPnl.toString()).toFixed(2)}`
      },
      performance: {
        totalReturn: `${metrics.totalReturnPercentage.toFixed(2)}%`,
        sharpeRatio: metrics.sharpeRatio.toFixed(3),
        winRate: `${(metrics.winRate * 100).toFixed(1)}%`,
        trades: metrics.totalTrades
      },
      risk: {
        maxDrawdown: `${riskMetrics.currentDrawdown.toFixed(2)}%`,
        volatility: `${(riskMetrics.volatility * 100).toFixed(2)}%`,
        var95: riskMetrics.var95.toFixed(4)
      },
      status: {
        alerts: alerts.length,
        realTimeActive: true,
        lastUpdated: new Date().toISOString()
      }
    };

    console.log(JSON.stringify(summary, null, 2));

    tradingLogger.info('✅ Performance Analytics demonstration completed successfully');

  } catch (error) {
    tradingLogger.error('❌ Performance Analytics demonstration failed', error as Error);
    throw error;
  }
}

// Export for testing
export { performanceAnalyticsService };