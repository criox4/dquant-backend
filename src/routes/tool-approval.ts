/**
 * Tool Approval Routes - REST API for managing AI tool call approvals
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { toolApprovalService } from '@/services/tool-approval.service';
import { apiLogger } from '@/services/logger';

export default async function toolApprovalRoutes(app: FastifyInstance): Promise<void> {
  const tags = ['Tool Approval'];

  /**
   * GET /tool-calls - List pending tool calls
   */
  app.get('/tool-calls', {
    schema: {
      description: 'List pending tool calls, optionally filtered by conversation',
      tags,
      querystring: {
        type: 'object',
        properties: {
          conversationId: {
            type: 'string',
            description: 'Filter by conversation ID'
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
                  callId: { type: 'string' },
                  conversationId: { type: 'string' },
                  userId: { type: 'string' },
                  toolName: { type: 'string' },
                  toolLabel: { type: 'string' },
                  reason: { type: 'string' },
                  params: { type: 'object' },
                  status: {
                    type: 'string',
                    enum: ['pending', 'approved', 'rejected', 'cancelled']
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  resolvedAt: { type: 'string', format: 'date-time', nullable: true }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = request.query as { conversationId?: string };
      const pending = toolApprovalService.listPending(conversationId);

      await reply.send({
        success: true,
        data: pending
      });
    } catch (error) {
      apiLogger.error('Failed to list pending tool calls:', error);
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /tool-calls/:callId/approve - Approve a pending tool call
   */
  app.post('/tool-calls/:callId/approve', {
    schema: {
      description: 'Approve a pending tool call',
      tags,
      params: {
        type: 'object',
        properties: {
          callId: { type: 'string', description: 'Tool call ID' }
        },
        required: ['callId']
      },
      body: {
        type: 'object',
        properties: {
          overrides: {
            type: 'object',
            description: 'Parameter overrides to apply to the tool call'
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
                callId: { type: 'string' },
                status: { type: 'string' },
                resolvedAt: { type: 'string', format: 'date-time' }
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
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { callId } = request.params as { callId: string };
      const { overrides = {} } = request.body as { overrides?: Record<string, any> };

      const entry = toolApprovalService.approve(callId, overrides);

      await reply.send({
        success: true,
        data: entry
      });
    } catch (error) {
      apiLogger.error('Failed to approve tool call:', error);
      await reply.status(400).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /tool-calls/:callId/reject - Reject a pending tool call
   */
  app.post('/tool-calls/:callId/reject', {
    schema: {
      description: 'Reject a pending tool call',
      tags,
      params: {
        type: 'object',
        properties: {
          callId: { type: 'string', description: 'Tool call ID' }
        },
        required: ['callId']
      },
      body: {
        type: 'object',
        properties: {
          feedback: {
            type: 'string',
            description: 'Optional feedback message explaining the rejection'
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
                callId: { type: 'string' },
                status: { type: 'string' },
                resolvedAt: { type: 'string', format: 'date-time' }
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
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { callId } = request.params as { callId: string };
      const { feedback = null } = request.body as { feedback?: string };

      const entry = toolApprovalService.reject(callId, feedback);

      await reply.send({
        success: true,
        data: entry
      });
    } catch (error) {
      apiLogger.error('Failed to reject tool call:', error);
      await reply.status(400).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * GET /tool-calls/:callId - Get specific tool call details
   */
  app.get('/tool-calls/:callId', {
    schema: {
      description: 'Get details of a specific tool call',
      tags,
      params: {
        type: 'object',
        properties: {
          callId: { type: 'string', description: 'Tool call ID' }
        },
        required: ['callId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                callId: { type: 'string' },
                conversationId: { type: 'string' },
                userId: { type: 'string' },
                toolName: { type: 'string' },
                toolLabel: { type: 'string' },
                reason: { type: 'string' },
                params: { type: 'object' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                resolvedAt: { type: 'string', format: 'date-time', nullable: true }
              }
            }
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { callId } = request.params as { callId: string };
      const call = toolApprovalService.getPendingCall(callId);

      if (!call) {
        await reply.status(404).send({
          success: false,
          error: 'Tool call not found'
        });
        return;
      }

      await reply.send({
        success: true,
        data: call
      });
    } catch (error) {
      apiLogger.error('Failed to get tool call:', error);
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * GET /tool-calls/stats - Get tool approval statistics
   */
  app.get('/tool-calls/stats', {
    schema: {
      description: 'Get statistics about pending tool calls',
      tags,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalPending: { type: 'number' },
                byConversation: { type: 'object' },
                byTool: { type: 'object' },
                oldestPending: { type: 'string', nullable: true }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = toolApprovalService.getStats();

      await reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      apiLogger.error('Failed to get tool call stats:', error);
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  /**
   * POST /tool-calls/cleanup - Clean up old pending calls
   */
  app.post('/tool-calls/cleanup', {
    schema: {
      description: 'Clean up old pending tool calls',
      tags,
      body: {
        type: 'object',
        properties: {
          maxAgeHours: {
            type: 'number',
            minimum: 1,
            maximum: 168, // 1 week
            default: 24,
            description: 'Maximum age in hours for pending calls'
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
                cleanedCount: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { maxAgeHours = 24 } = request.body as { maxAgeHours?: number };
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

      const cleanedCount = toolApprovalService.cleanupOldCalls(maxAgeMs);

      await reply.send({
        success: true,
        data: {
          cleanedCount
        }
      });
    } catch (error) {
      apiLogger.error('Failed to cleanup tool calls:', error);
      await reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });
}