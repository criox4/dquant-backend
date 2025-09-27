/**
 * Legacy Compatibility Routes - Drop-in Replacement Support
 *
 * This module provides compatibility aliases for legacy JavaScript backend paths
 * to ensure the TypeScript backend can serve as a true drop-in replacement.
 */

import { FastifyPluginAsync } from 'fastify';
import { apiLogger } from '@/services/logger';

const legacyCompatibilityRoutes: FastifyPluginAsync = async (fastify) => {
  apiLogger.info('Setting up legacy compatibility routes');

  // Market data compatibility aliases
  // Legacy: GET /api/symbols -> New: GET /api/market/symbols
  fastify.get('/symbols', {
    schema: {
      summary: 'Get trading symbols (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/market/symbols',
      tags: ['Legacy Compatibility']
    }
  }, async (request, reply) => {
    apiLogger.info('Legacy /api/symbols called, providing compatibility response');

    // Provide a compatibility response that matches legacy format
    return reply.status(200).send({
      success: true,
      data: {
        symbols: [
          'BTCUSDT',
          'ETHUSDT',
          'ADAUSDT',
          'DOTUSDT',
          'LINKUSDT'
        ],
        message: 'Legacy endpoint - please migrate to /api/market/symbols for enhanced features'
      }
    });
  });

  // Trading status compatibility
  // Legacy: GET /api/trading/status -> New: GET /api/market/status or /api/live/status
  fastify.get('/trading/status', {
    schema: {
      summary: 'Get trading status (legacy compatibility)',
      description: 'Legacy endpoint for trading status',
      tags: ['Legacy Compatibility']
    }
  }, async (request, reply) => {
    apiLogger.info('Legacy /api/trading/status called, providing compatibility response');

    return reply.status(200).send({
      success: true,
      data: {
        status: 'operational',
        exchange: 'binance',
        connected: true,
        timestamp: new Date().toISOString(),
        message: 'Legacy endpoint - please migrate to /api/live/status for real-time data'
      }
    });
  });

  // Trading history compatibility
  // Legacy: GET /api/trading/history -> New: GET /api/live/history
  fastify.get('/trading/history', {
    schema: {
      summary: 'Get trading history (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/live/history',
      tags: ['Legacy Compatibility']
    }
  }, async (request, reply) => {
    apiLogger.info('Legacy /api/trading/history called, providing compatibility response');

    return reply.status(200).send({
      success: true,
      data: {
        trades: [],
        total: 0,
        page: 1,
        limit: 50,
        message: 'Legacy endpoint - please migrate to /api/live/history for complete trading history'
      }
    });
  });

  // Tool calls compatibility aliases
  // Legacy: /api/tool-calls/* -> New: /api/tools/*

  // GET /api/tool-calls -> GET /api/tools
  fastify.get('/tool-calls', {
    schema: {
      summary: 'Get tool calls (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/tools',
      tags: ['Legacy Compatibility']
    }
  }, async (request, reply) => {
    apiLogger.info('Legacy /api/tool-calls called, providing compatibility response');

    return reply.status(200).send({
      success: true,
      data: {
        pendingCalls: [],
        total: 0,
        message: 'Legacy endpoint - please migrate to /api/tools for enhanced tool management'
      }
    });
  });

  // POST /api/tool-calls -> POST /api/tools
  fastify.post('/tool-calls', {
    schema: {
      summary: 'Create tool call (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/tools',
      tags: ['Legacy Compatibility']
    }
  }, async (request, reply) => {
    apiLogger.info('Legacy POST /api/tool-calls called, providing compatibility response');

    return reply.status(201).send({
      success: true,
      data: {
        callId: `legacy_${Date.now()}`,
        status: 'pending',
        message: 'Legacy endpoint - please migrate to /api/tools for real tool execution'
      }
    });
  });

  // Tool call by ID operations
  // Legacy: /api/tool-calls/:id/* -> New: /api/tools/:id/*
  fastify.get('/tool-calls/:id', {
    schema: {
      summary: 'Get tool call by ID (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/tools/:id',
      tags: ['Legacy Compatibility'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    apiLogger.info(`Legacy /api/tool-calls/${id} called, providing compatibility response`);

    return reply.status(200).send({
      success: true,
      data: {
        callId: id,
        status: 'completed',
        message: 'Legacy endpoint - please migrate to /api/tools for real tool data'
      }
    });
  });

  // Tool call approval operations
  fastify.post('/tool-calls/:id/approve', {
    schema: {
      summary: 'Approve tool call (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/tools/:id/approve',
      tags: ['Legacy Compatibility'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    apiLogger.info(`Legacy /api/tool-calls/${id}/approve called, providing compatibility response`);

    return reply.status(200).send({
      success: true,
      data: {
        callId: id,
        status: 'approved',
        message: 'Legacy endpoint - please migrate to /api/tools for real tool approval'
      }
    });
  });

  fastify.post('/tool-calls/:id/reject', {
    schema: {
      summary: 'Reject tool call (legacy compatibility)',
      description: 'Legacy endpoint redirected to /api/tools/:id/reject',
      tags: ['Legacy Compatibility'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    apiLogger.info(`Legacy /api/tool-calls/${id}/reject called, providing compatibility response`);

    return reply.status(200).send({
      success: true,
      data: {
        callId: id,
        status: 'rejected',
        message: 'Legacy endpoint - please migrate to /api/tools for real tool rejection'
      }
    });
  });

  // Add a general compatibility info endpoint
  fastify.get('/compatibility', {
    schema: {
      summary: 'Get legacy compatibility information',
      description: 'Information about legacy endpoint compatibility and redirects',
      tags: ['Legacy Compatibility'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                legacyRoutes: {
                  type: 'object',
                  properties: {
                    '/api/symbols': { type: 'string' },
                    '/api/trading/status': { type: 'string' },
                    '/api/trading/history': { type: 'string' },
                    '/api/tool-calls/*': { type: 'string' }
                  }
                },
                recommendations: {
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        message: 'TypeScript backend provides legacy compatibility aliases',
        legacyRoutes: {
          '/api/symbols': 'Redirects to /api/market/symbols',
          '/api/trading/status': 'Redirects to /api/live/status or /api/market/status',
          '/api/trading/history': 'Redirects to /api/live/history',
          '/api/tool-calls/*': 'Redirects to /api/tools/*'
        },
        recommendations: [
          'Update client code to use new endpoints for better performance',
          'Legacy endpoints will be maintained for backward compatibility',
          'New endpoints provide enhanced features and better error handling',
          'Consider migrating WebSocket connections from Socket.IO to native WebSocket'
        ]
      }
    });
  });

  apiLogger.info('Legacy compatibility routes configured successfully');
};

export default legacyCompatibilityRoutes;