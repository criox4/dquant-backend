/**
 * Performance Analytics Routes - Advanced Trading Performance Analysis API
 * Provides REST endpoints for comprehensive performance metrics and analytics
 */

import { FastifyInstance, FastifyRequest } from 'fastify';
import { performanceAnalyticsService } from '@/services/performance-analytics';
import { tradingLogger } from '@/services/logger';

// Request/Response Types
interface MetricsRequest {
  Params: {
    accountId: string;
  };
  Querystring: {
    startDate?: string;
    endDate?: string;
    period?: string;
  };
}

interface EquityCurveRequest {
  Params: {
    accountId: string;
  };
  Querystring: {
    startDate?: string;
    endDate?: string;
    resolution?: 'daily' | 'hourly' | 'minute';
  };
}

interface RollingMetricsRequest {
  Params: {
    accountId: string;
  };
  Querystring: {
    period: string;
    days?: string;
  };
}

// Removed unused RealTimeRequest interface

export default async function performanceAnalyticsRoutes(app: FastifyInstance) {
  // Get comprehensive performance metrics
  app.get('/accounts/:accountId/metrics', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get comprehensive performance metrics',
      description: 'Calculate and return detailed performance metrics for a trading account',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string', description: 'Paper trading account ID' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date', description: 'Start date for analysis (ISO 8601)' },
          endDate: { type: 'string', format: 'date', description: 'End date for analysis (ISO 8601)' },
          period: {
            type: 'string',
            enum: ['1d', '7d', '30d', '90d', '180d', '365d', 'all'],
            description: 'Analysis period shorthand'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                // Return Metrics
                totalReturn: { type: 'number' },
                totalReturnPercentage: { type: 'number' },
                annualizedReturn: { type: 'number' },
                cumulativeReturn: { type: 'number' },

                // Risk Metrics
                sharpeRatio: { type: 'number' },
                sortinRatio: { type: 'number' },
                calmarRatio: { type: 'number' },
                maximumDrawdown: { type: 'number' },
                maximumDrawdownPercentage: { type: 'number' },
                volatility: { type: 'number' },
                valueAtRisk: { type: 'number' },

                // Trade Statistics
                totalTrades: { type: 'number' },
                winningTrades: { type: 'number' },
                losingTrades: { type: 'number' },
                winRate: { type: 'number' },
                averageWin: { type: 'number' },
                averageLoss: { type: 'number' },
                profitFactor: { type: 'number' },

                // Time-based Metrics
                averageHoldingTime: { type: 'number' },
                tradingFrequency: { type: 'number' },
                expectancy: { type: 'number' },

                // Period Information
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
                totalDays: { type: 'number' },
                tradingDays: { type: 'number' }
              }
            },
            metadata: {
              type: 'object',
              properties: {
                calculationTime: { type: 'number' },
                cached: { type: 'boolean' },
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<MetricsRequest>, reply) => {
    try {
      const { accountId } = request.params;
      const { startDate, endDate, period } = request.query;

      // Parse dates if provided
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (period) {
        const now = new Date();
        switch (period) {
          case '1d':
            parsedStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            parsedStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            parsedStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90d':
            parsedStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case '180d':
            parsedStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
          case '365d':
            parsedStartDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        }
        parsedEndDate = now;
      } else {
        if (startDate) parsedStartDate = new Date(startDate);
        if (endDate) parsedEndDate = new Date(endDate);
      }

      const startTime = Date.now();
      const metrics = await performanceAnalyticsService.calculatePerformanceMetrics(
        accountId,
        parsedStartDate,
        parsedEndDate
      );
      const calculationTime = Date.now() - startTime;

      tradingLogger.info('Performance metrics calculated', {
        accountId,
        calculationTime,
        totalReturn: metrics.totalReturn,
        winRate: metrics.winRate
      });

      return reply.send({
        success: true,
        data: metrics,
        metadata: {
          calculationTime,
          cached: false,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      tradingLogger.error('Error getting performance metrics', error as Error);

      if (error instanceof Error && error.message === 'Account not found') {
        return reply.status(404).send({
          success: false,
          error: 'Account not found'
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to calculate performance metrics'
      });
    }
  });

  // Get risk metrics
  app.get('/accounts/:accountId/risk', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get comprehensive risk metrics',
      description: 'Calculate and return detailed risk analysis for a trading account',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                currentDrawdown: { type: 'number' },
                currentDrawdownDuration: { type: 'number' },
                maxDrawdownDuration: { type: 'number' },
                sharpeRatio: { type: 'number' },
                sortinRatio: { type: 'number' },
                calmarRatio: { type: 'number' },
                volatility: { type: 'number' },
                var95: { type: 'number' },
                var99: { type: 'number' },
                cvar95: { type: 'number' },
                cvar99: { type: 'number' },
                beta: { type: 'number' },
                alpha: { type: 'number' },
                skewness: { type: 'number' },
                kurtosis: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<MetricsRequest>, reply) => {
    try {
      const { accountId } = request.params;
      const { startDate, endDate } = request.query;

      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      const riskMetrics = await performanceAnalyticsService.calculateRiskMetrics(
        accountId,
        parsedStartDate,
        parsedEndDate
      );

      return reply.send({
        success: true,
        data: riskMetrics
      });

    } catch (error) {
      tradingLogger.error('Error getting risk metrics', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to calculate risk metrics'
      });
    }
  });

  // Get equity curve
  app.get('/accounts/:accountId/equity-curve', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get equity curve data',
      description: 'Generate equity curve data points for visualization',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          resolution: {
            type: 'string',
            enum: ['daily', 'hourly', 'minute'],
            default: 'daily'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  equity: { type: 'number' },
                  drawdown: { type: 'number' },
                  trades: { type: 'number' },
                  returns: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<EquityCurveRequest>, reply) => {
    try {
      const { accountId } = request.params;
      const { startDate, endDate } = request.query;

      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      const equityCurve = await performanceAnalyticsService.generateEquityCurve(
        accountId,
        parsedStartDate,
        parsedEndDate
      );

      return reply.send({
        success: true,
        data: equityCurve
      });

    } catch (error) {
      tradingLogger.error('Error generating equity curve', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate equity curve'
      });
    }
  });

  // Get drawdown curve
  app.get('/accounts/:accountId/drawdown-curve', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get drawdown curve data',
      description: 'Generate drawdown curve data points for visualization',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string', format: 'date-time' },
                  drawdown: { type: 'number' },
                  drawdownPercentage: { type: 'number' },
                  isNewHigh: { type: 'boolean' },
                  daysSinceHigh: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<EquityCurveRequest>, reply) => {
    try {
      const { accountId } = request.params;
      const { startDate, endDate } = request.query;

      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      const drawdownCurve = await performanceAnalyticsService.generateDrawdownCurve(
        accountId,
        parsedStartDate,
        parsedEndDate
      );

      return reply.send({
        success: true,
        data: drawdownCurve
      });

    } catch (error) {
      tradingLogger.error('Error generating drawdown curve', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate drawdown curve'
      });
    }
  });

  // Get rolling metrics
  app.get('/accounts/:accountId/rolling-metrics', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get rolling performance metrics',
      description: 'Calculate rolling performance metrics over specified periods',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        required: ['period'],
        properties: {
          period: {
            type: 'string',
            description: 'Rolling window period in days (e.g., "30")'
          },
          days: {
            type: 'string',
            description: 'Number of days to analyze (default: 365)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', format: 'date-time' },
                  period: { type: 'number' },
                  returns: { type: 'number' },
                  volatility: { type: 'number' },
                  sharpeRatio: { type: 'number' },
                  maxDrawdown: { type: 'number' },
                  winRate: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<RollingMetricsRequest>, reply) => {
    try {
      const { accountId } = request.params;
      const { period } = request.query;

      const periodDays = parseInt(period);
      if (isNaN(periodDays) || periodDays < 1) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid period parameter'
        });
      }

      const rollingMetrics = await performanceAnalyticsService.calculateRollingMetrics(
        accountId,
        periodDays
      );

      return reply.send({
        success: true,
        data: rollingMetrics
      });

    } catch (error) {
      tradingLogger.error('Error calculating rolling metrics', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to calculate rolling metrics'
      });
    }
  });

  // Get performance alerts
  app.get('/accounts/:accountId/alerts', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get performance alerts',
      description: 'Check for active performance alerts and warnings',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string', enum: ['warning', 'critical', 'info'] },
                  title: { type: 'string' },
                  message: { type: 'string' },
                  metric: { type: 'string' },
                  currentValue: { type: 'number' },
                  thresholdValue: { type: 'number' },
                  timestamp: { type: 'string', format: 'date-time' },
                  accountId: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply) => {
    try {
      const { accountId } = request.params;

      const alerts = await performanceAnalyticsService.checkPerformanceAlerts(accountId);

      return reply.send({
        success: true,
        data: alerts
      });

    } catch (error) {
      tradingLogger.error('Error checking performance alerts', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check performance alerts'
      });
    }
  });

  // Start/stop real-time analytics
  app.post('/accounts/:accountId/real-time', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Control real-time analytics',
      description: 'Start or stop real-time performance analytics calculations',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['enable'],
        properties: {
          enable: {
            type: 'boolean',
            description: 'Whether to enable or disable real-time analytics'
          },
          frequency: {
            type: 'number',
            minimum: 10,
            maximum: 300,
            description: 'Update frequency in seconds (10-300, default: 60)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            status: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const { enable } = request.body as { enable: boolean; frequency: number };

      if (enable) {
        await performanceAnalyticsService.startRealTimeAnalytics(accountId);
        return reply.send({
          success: true,
          message: 'Real-time analytics started',
          status: 'active'
        });
      } else {
        await performanceAnalyticsService.stopRealTimeAnalytics(accountId);
        return reply.send({
          success: true,
          message: 'Real-time analytics stopped',
          status: 'inactive'
        });
      }

    } catch (error) {
      tradingLogger.error('Error controlling real-time analytics', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to control real-time analytics'
      });
    }
  });

  // Analytics dashboard summary
  app.get('/accounts/:accountId/dashboard', {
    schema: {
      tags: ['Performance Analytics'],
      summary: 'Get analytics dashboard summary',
      description: 'Get a comprehensive summary for analytics dashboard',
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                overview: {
                  type: 'object',
                  properties: {
                    totalReturn: { type: 'number' },
                    totalReturnPercentage: { type: 'number' },
                    sharpeRatio: { type: 'number' },
                    maximumDrawdown: { type: 'number' },
                    winRate: { type: 'number' },
                    totalTrades: { type: 'number' }
                  }
                },
                risk: {
                  type: 'object',
                  properties: {
                    currentDrawdown: { type: 'number' },
                    volatility: { type: 'number' },
                    var95: { type: 'number' },
                    beta: { type: 'number' }
                  }
                },
                recentPerformance: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      value: { type: 'number' },
                      change: { type: 'number' }
                    }
                  }
                },
                alerts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string' },
                      message: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply) => {
    try {
      const { accountId } = request.params;

      const [metrics, riskMetrics, alerts] = await Promise.all([
        performanceAnalyticsService.calculatePerformanceMetrics(accountId),
        performanceAnalyticsService.calculateRiskMetrics(accountId),
        performanceAnalyticsService.checkPerformanceAlerts(accountId)
      ]);

      const dashboard = {
        overview: {
          totalReturn: metrics.totalReturn,
          totalReturnPercentage: metrics.totalReturnPercentage,
          sharpeRatio: metrics.sharpeRatio,
          maximumDrawdown: metrics.maximumDrawdown,
          winRate: metrics.winRate,
          totalTrades: metrics.totalTrades
        },
        risk: {
          currentDrawdown: riskMetrics.currentDrawdown,
          volatility: riskMetrics.volatility,
          var95: riskMetrics.var95,
          beta: riskMetrics.beta
        },
        recentPerformance: [], // Would be populated with recent equity points
        alerts: alerts.map(alert => ({
          type: alert.type,
          message: alert.message
        }))
      };

      return reply.send({
        success: true,
        data: dashboard
      });

    } catch (error) {
      tradingLogger.error('Error generating analytics dashboard', error as Error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate analytics dashboard'
      });
    }
  });

  tradingLogger.info('📊 Performance Analytics routes registered');
}