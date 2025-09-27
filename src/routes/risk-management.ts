/**
 * Risk Management API Routes
 * RESTful endpoints for risk management operations
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { riskManagementService } from '@/services/risk-management';
import { tradingLogger } from '@/services/logger';
import {
  RiskProfile,
  PreTradeRiskCheck,
  PositionSizingConfig,
  PositionSizingModel
} from '@/types/risk-management';

// Request/Response types removed - using direct casting instead

// MonitoringRequest interface removed - using direct casting

// EmergencyActionRequest interface removed - using direct casting

export async function riskManagementRoutes(app: FastifyInstance): Promise<void> {
  // OpenAPI Tags
  const tags = ['Risk Management'];

  // 1. Get Risk Profile
  app.get('/accounts/:accountId/risk/profile', {
    schema: {
      summary: 'Get account risk profile',
      description: 'Retrieve risk management configuration for a trading account',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Risk profile retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                maxAccountRisk: { type: 'number', description: 'Max % of account per trade' },
                maxPositionSize: { type: 'number', description: 'Max position size per trade' },
                maxDailyLoss: { type: 'number', description: 'Max daily loss in %' },
                maxDrawdown: { type: 'number', description: 'Max portfolio drawdown %' },
                maxLeverage: { type: 'number', description: 'Max leverage multiplier' },
                stopLossRequired: { type: 'boolean' },
                takeProfitRequired: { type: 'boolean' },
                maxOpenPositions: { type: 'number' },
                sectorConcentrationLimit: { type: 'number' },
                correlationLimit: { type: 'number' },
                volatilityLimit: { type: 'number' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        404: {
          description: 'Account not found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const profile = await riskManagementService.loadRiskProfile(accountId);

      await reply.status(200).send({
        success: true,
        data: profile
      });

    } catch (error) {
      tradingLogger.error('Failed to get risk profile', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve risk profile'
      });
    }
  });

  // 2. Update Risk Profile
  app.put('/accounts/:accountId/risk/profile', {
    schema: {
      summary: 'Update account risk profile',
      description: 'Update risk management configuration for a trading account',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          maxAccountRisk: { type: 'number', minimum: 0.1, maximum: 100 },
          maxPositionSize: { type: 'number', minimum: 100 },
          maxDailyLoss: { type: 'number', minimum: 0.1, maximum: 100 },
          maxDrawdown: { type: 'number', minimum: 1, maximum: 100 },
          maxLeverage: { type: 'number', minimum: 1, maximum: 100 },
          stopLossRequired: { type: 'boolean' },
          takeProfitRequired: { type: 'boolean' },
          maxOpenPositions: { type: 'number', minimum: 1 },
          sectorConcentrationLimit: { type: 'number', minimum: 5, maximum: 100 },
          correlationLimit: { type: 'number', minimum: 0, maximum: 1 },
          volatilityLimit: { type: 'number', minimum: 1, maximum: 100 }
        }
      },
      response: {
        200: {
          description: 'Risk profile updated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                maxAccountRisk: { type: 'number' },
                maxPositionSize: { type: 'number' },
                maxDailyLoss: { type: 'number' },
                maxDrawdown: { type: 'number' },
                maxLeverage: { type: 'number' },
                stopLossRequired: { type: 'boolean' },
                takeProfitRequired: { type: 'boolean' },
                maxOpenPositions: { type: 'number' },
                sectorConcentrationLimit: { type: 'number' },
                correlationLimit: { type: 'number' },
                volatilityLimit: { type: 'number' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const updates = request.body as Partial<RiskProfile>;

      const updatedProfile = await riskManagementService.updateRiskProfile(accountId, updates);

      await reply.status(200).send({
        success: true,
        data: updatedProfile
      });

    } catch (error) {
      tradingLogger.error('Failed to update risk profile', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to update risk profile'
      });
    }
  });

  // 3. Pre-trade Risk Check
  app.post('/risk/pre-trade-check', {
    schema: {
      summary: 'Perform pre-trade risk assessment',
      description: 'Validate a trade against risk management rules before execution',
      tags,
      body: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' },
          symbol: { type: 'string', description: 'Trading symbol' },
          side: { type: 'string', enum: ['buy', 'sell'], description: 'Trade direction' },
          quantity: { type: 'number', minimum: 0.001, description: 'Quantity to trade' },
          price: { type: 'number', minimum: 0.001, description: 'Price per unit' },
          orderType: { type: 'string', description: 'Order type' }
        },
        required: ['accountId', 'symbol', 'side', 'quantity', 'price']
      },
      response: {
        200: {
          description: 'Pre-trade risk check completed',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                isApproved: { type: 'boolean' },
                violations: { type: 'array', items: { type: 'object' } },
                warnings: { type: 'array', items: { type: 'string' } },
                adjustedQuantity: { type: 'number' },
                maxAllowedQuantity: { type: 'number' },
                accountRisk: { type: 'number' },
                portfolioImpact: { type: 'number' },
                correlationImpact: { type: 'number' },
                liquidityScore: { type: 'number' },
                positionValue: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const tradeRequest: PreTradeRiskCheck = {
        ...body,
        orderType: body.orderType || 'market',
        isApproved: false,
        violations: [],
        warnings: [],
        maxAllowedQuantity: 0,
        accountRisk: 0,
        portfolioImpact: 0,
        correlationImpact: 0,
        liquidityScore: 0,
        positionValue: body.quantity * body.price,
        timestamp: new Date()
      };

      const result = await riskManagementService.checkPreTradeRisk(tradeRequest);

      await reply.status(200).send({
        success: true,
        data: result
      });

    } catch (error) {
      tradingLogger.error('Pre-trade risk check failed', { error, body: request.body });
      await reply.status(500).send({
        success: false,
        error: 'Pre-trade risk check failed'
      });
    }
  });

  // 4. Calculate Position Size
  app.post('/risk/position-size', {
    schema: {
      summary: 'Calculate optimal position size',
      description: 'Calculate position size based on risk management rules and sizing model',
      tags,
      body: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' },
          symbol: { type: 'string', description: 'Trading symbol' },
          riskAmount: { type: 'number', minimum: 1, description: 'Amount to risk' },
          config: {
            type: 'object',
            properties: {
              model: {
                type: 'string',
                enum: Object.values(PositionSizingModel),
                description: 'Position sizing model'
              },
              fixedAmount: { type: 'number' },
              fixedPercentage: { type: 'number' },
              kellyFraction: { type: 'number' },
              volatilityTarget: { type: 'number' },
              lookbackPeriod: { type: 'number' },
              maxPosition: { type: 'number' },
              minPosition: { type: 'number' }
            }
          }
        },
        required: ['accountId', 'symbol', 'riskAmount']
      },
      response: {
        200: {
          description: 'Position size calculated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                positionSize: { type: 'number' },
                model: { type: 'string' },
                accountId: { type: 'string' },
                symbol: { type: 'string' },
                riskAmount: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId, symbol, riskAmount, config } = request.body as { accountId: string; symbol: string; riskAmount: number; config?: PositionSizingConfig };

      const positionSize = await riskManagementService.calculatePositionSize(
        accountId,
        symbol,
        riskAmount,
        config
      );

      await reply.status(200).send({
        success: true,
        data: {
          positionSize,
          model: config?.model || PositionSizingModel.FIXED_PERCENTAGE,
          accountId,
          symbol,
          riskAmount
        }
      });

    } catch (error) {
      tradingLogger.error('Position size calculation failed', { error, body: request.body });
      await reply.status(500).send({
        success: false,
        error: 'Position size calculation failed'
      });
    }
  });

  // 5. Get Portfolio Risk Metrics
  app.get('/accounts/:accountId/risk/metrics', {
    schema: {
      summary: 'Get portfolio risk metrics',
      description: 'Calculate and retrieve comprehensive portfolio risk metrics',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Portfolio risk metrics retrieved successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                totalExposure: { type: 'number' },
                netExposure: { type: 'number' },
                grossExposure: { type: 'number' },
                leverage: { type: 'number' },
                currentDrawdown: { type: 'number' },
                maxDrawdown: { type: 'number' },
                portfolioVolatility: { type: 'number' },
                var95: { type: 'number' },
                cvar95: { type: 'number' },
                sharpeRatio: { type: 'number' },
                maxPositionExposure: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const metrics = await riskManagementService.calculatePortfolioRisk(accountId);

      await reply.status(200).send({
        success: true,
        data: metrics
      });

    } catch (error) {
      tradingLogger.error('Failed to get portfolio risk metrics', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to retrieve portfolio risk metrics'
      });
    }
  });

  // 6. Get Risk Report
  app.get('/accounts/:accountId/risk/report', {
    schema: {
      summary: 'Generate comprehensive risk report',
      description: 'Generate detailed risk analysis report with recommendations',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Risk report generated successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                reportDate: { type: 'string', format: 'date-time' },
                overallRiskScore: { type: 'number', minimum: 0, maximum: 100 },
                riskGrade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
                portfolioRisk: { type: 'object' },
                activeViolations: { type: 'array' },
                recommendations: { type: 'array' },
                riskTrend: { type: 'string', enum: ['improving', 'stable', 'deteriorating'] }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const report = await riskManagementService.generateRiskReport(accountId);

      await reply.status(200).send({
        success: true,
        data: report
      });

    } catch (error) {
      tradingLogger.error('Failed to generate risk report', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to generate risk report'
      });
    }
  });

  // 7. Validate Risk Rules
  app.get('/accounts/:accountId/risk/violations', {
    schema: {
      summary: 'Check for risk rule violations',
      description: 'Validate current portfolio against all risk management rules',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Risk violations checked successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                violations: { type: 'array', items: { type: 'object' } },
                violationCount: { type: 'number' },
                severityBreakdown: { type: 'object' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const violations = await riskManagementService.validateRiskRules(accountId);

      // Calculate severity breakdown
      const severityBreakdown = violations.reduce((acc, violation) => {
        acc[violation.severity] = (acc[violation.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      await reply.status(200).send({
        success: true,
        data: {
          violations,
          violationCount: violations.length,
          severityBreakdown
        }
      });

    } catch (error) {
      tradingLogger.error('Failed to validate risk rules', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to validate risk rules'
      });
    }
  });

  // 8. Start/Stop Risk Monitoring
  app.post('/accounts/:accountId/risk/monitoring/start', {
    schema: {
      summary: 'Start real-time risk monitoring',
      description: 'Begin continuous monitoring of portfolio risk metrics',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Risk monitoring started successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      await riskManagementService.startMonitoring(accountId);

      await reply.status(200).send({
        success: true,
        message: `Risk monitoring started for account ${accountId}`
      });

    } catch (error) {
      tradingLogger.error('Failed to start risk monitoring', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to start risk monitoring'
      });
    }
  });

  app.post('/accounts/:accountId/risk/monitoring/stop', {
    schema: {
      summary: 'Stop real-time risk monitoring',
      description: 'Stop continuous monitoring of portfolio risk metrics',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      response: {
        200: {
          description: 'Risk monitoring stopped successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      await riskManagementService.stopMonitoring(accountId);

      await reply.status(200).send({
        success: true,
        message: `Risk monitoring stopped for account ${accountId}`
      });

    } catch (error) {
      tradingLogger.error('Failed to stop risk monitoring', { error, accountId: (request.params as { accountId: string }).accountId });
      await reply.status(500).send({
        success: false,
        error: 'Failed to stop risk monitoring'
      });
    }
  });

  // 9. Emergency Actions
  app.post('/accounts/:accountId/risk/emergency', {
    schema: {
      summary: 'Execute emergency risk action',
      description: 'Execute emergency actions like stop loss, position reduction, or liquidation',
      tags,
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Trading account ID' }
        },
        required: ['accountId']
      },
      body: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['stop_loss', 'reduce_positions', 'liquidate'],
            description: 'Emergency action to execute'
          },
          percentage: {
            type: 'number',
            minimum: 1,
            maximum: 100,
            description: 'Percentage for position reduction (if applicable)'
          }
        },
        required: ['action']
      },
      response: {
        200: {
          description: 'Emergency action executed successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            action: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = request.params as { accountId: string };
      const { action, percentage } = request.body as { action: string; percentage?: number; };

      switch (action) {
        case 'stop_loss':
          await riskManagementService.emergencyStopLoss(accountId);
          break;
        case 'reduce_positions':
          if (!percentage) {
            throw new Error('Percentage required for position reduction');
          }
          await riskManagementService.reducePositions(accountId, percentage);
          break;
        case 'liquidate':
          await riskManagementService.liquidateAccount(accountId);
          break;
        default:
          throw new Error(`Unknown emergency action: ${action}`);
      }

      await reply.status(200).send({
        success: true,
        message: `Emergency action '${action}' executed successfully`,
        action,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      tradingLogger.error('Emergency action failed', {
        error,
        accountId: (request.params as { accountId: string }).accountId,
        action: (request.body as { action: string }).action
      });
      await reply.status(500).send({
        success: false,
        error: `Emergency action failed: ${(error as Error).message}`
      });
    }
  });

  tradingLogger.info('Risk Management API routes registered', {
    endpoints: 9,
    component: 'api'
  });
}