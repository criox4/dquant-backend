import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { conversationManager } from '@/services/conversation-manager';
import { apiLogger } from '@/services/logger';
import { aiOrchestrator } from '@/services/ai-orchestrator';
import { broadcastToRoom, broadcastToUser } from '@/websocket/server';
import { z } from 'zod';

// Zod schemas for request validation
const createConversationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().optional()
});

const sendMessageSchema = z.object({
  message: z.string().min(1),
  streamResponse: z.boolean().default(false)
});

const getConversationParamsSchema = z.object({
  conversationId: z.string().uuid()
});

const getUserConversationsSchema = z.object({
  userId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20)
});

// Type definitions removed - using FastifyRequest directly with type assertions

const conversationsRoutes: FastifyPluginAsync = async (fastify) => {
  // Register schemas for OpenAPI documentation
  fastify.addSchema({
    $id: 'createConversationRequest',
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User ID' },
      title: { type: 'string', description: 'Optional conversation title' }
    },
    required: ['userId']
  });

  fastify.addSchema({
    $id: 'sendMessageRequest',
    type: 'object',
    properties: {
      message: { type: 'string', description: 'User message content' },
      streamResponse: { type: 'boolean', default: false, description: 'Enable streaming response' }
    },
    required: ['message']
  });

  fastify.addSchema({
    $id: 'conversationResponse',
    type: 'object',
    properties: {
      conversationId: { type: 'string' },
      userId: { type: 'string' },
      title: { type: 'string', nullable: true },
      summary: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DELETED'] },
      lastMessageAt: { type: 'string', format: 'date-time' },
      totalTokens: { type: 'number' },
      metadata: { type: 'object' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  });

  fastify.addSchema({
    $id: 'messageResponse',
    type: 'object',
    properties: {
      message: { type: 'string' },
      data: { type: 'object' },
      metadata: { type: 'object' },
      conversationStatus: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DELETED'] }
    }
  });

  // POST /api/conversations - Create new conversation
  fastify.post('/conversations', {
    schema: {
      summary: 'Create a new conversation',
      description: 'Creates a new conversation for a user',
      tags: ['Conversations'],
      body: { $ref: 'createConversationRequest' },
      response: {
        201: {
          description: 'Conversation created successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'conversationResponse' }
          }
        },
        400: {
          description: 'Invalid request data',
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
      const validatedData = createConversationSchema.parse(request.body);

      apiLogger.info('Creating conversation', {
        userId: validatedData.userId,
        hasTitle: !!validatedData.title
      });

      const conversation = await conversationManager.createConversation(
        validatedData.userId,
        validatedData.title
      );

      return reply.status(201).send({
        success: true,
        data: conversation
      });
    } catch (error) {
      apiLogger.error('Failed to create conversation', error as Error);

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // POST /api/conversations/:conversationId/messages - Send message
  fastify.post('/conversations/:conversationId/messages', {
    schema: {
      summary: 'Send a message to a conversation',
      description: 'Sends a user message and gets AI response',
      tags: ['Conversations'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string', format: 'uuid' }
        }
      },
      body: { $ref: 'sendMessageRequest' },
      response: {
        200: {
          description: 'Message processed successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: 'messageResponse' }
          }
        },
        404: {
          description: 'Conversation not found',
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
      const { conversationId } = request.params as { conversationId: string };
      const validatedData = sendMessageSchema.parse(request.body);

      apiLogger.info('Processing message', {
        conversationId,
        messageLength: validatedData.message.length,
        streamResponse: validatedData.streamResponse
      });

      // Use AI orchestrator for intelligent multi-step task execution
      const userId = 'user-1'; // TODO: Get from JWT token
      const response = await aiOrchestrator.process({
        conversationId,
        userId,
        userMessage: validatedData.message,
        sendEvent: (event: string, payload: any) => {
          // Emit events via WebSocket for real-time notifications
          apiLogger.info('AI orchestrator event:', { event, payload });

          // Broadcast to user and conversation room
          const websocketEvent = {
            event,
            data: payload,
            timestamp: new Date().toISOString()
          };

          broadcastToUser(userId, websocketEvent).catch(error => {
            apiLogger.warn('Failed to broadcast AI event to user:', error);
          });

          broadcastToRoom(`conversation_${conversationId}`, websocketEvent).catch(error => {
            apiLogger.warn('Failed to broadcast AI event to conversation room:', error);
          });
        }
      });

      // If streaming is requested, handle streaming
      if (validatedData.streamResponse) {
        // TODO: Implement streaming response for AI orchestrator
        apiLogger.info('Streaming requested but not yet implemented for AI orchestrator');
      }

      return reply.send({
        success: true,
        data: response
      });
    } catch (error) {
      apiLogger.error('Failed to process message', error as Error, {
        conversationId: (request.params as any).conversationId
      });

      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request data',
          details: error.errors
        });
      }

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // GET /api/conversations/:conversationId - Get conversation details
  fastify.get('/conversations/:conversationId', {
    schema: {
      summary: 'Get conversation details',
      description: 'Retrieves conversation details and message history',
      tags: ['Conversations'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          description: 'Conversation details retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                conversation: { $ref: 'conversationResponse' },
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      messageId: { type: 'string' },
                      role: { type: 'string', enum: ['USER', 'ASSISTANT', 'SYSTEM'] },
                      content: { type: 'string' },
                      tokenCount: { type: 'number' },
                      metadata: { type: 'object' },
                      createdAt: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { conversationId } = getConversationParamsSchema.parse(request.params);

      const [conversationData, messages] = await Promise.all([
        conversationManager.conversationDataService.getConversation(conversationId),
        conversationManager.getConversationHistory(conversationId)
      ]);

      if (!conversationData) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }

      return reply.send({
        success: true,
        data: {
          conversation: conversationData,
          messages: messages
        }
      });
    } catch (error) {
      apiLogger.error('Failed to get conversation', error as Error);

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // GET /api/users/:userId/conversations - Get user conversations
  fastify.get('/users/:userId/conversations', {
    schema: {
      summary: 'Get user conversations',
      description: 'Retrieves all conversations for a specific user',
      tags: ['Conversations'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          description: 'User conversations retrieved',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                conversations: {
                  type: 'array',
                  items: { $ref: 'conversationResponse' }
                },
                total: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.params as { userId: string };
      const { limit = 20 } = getUserConversationsSchema.parse(request.query);

      apiLogger.info('Getting user conversations', { userId, limit });

      const conversations = await conversationManager.getUserConversations(userId, limit);

      return reply.send({
        success: true,
        data: {
          conversations,
          total: conversations.length
        }
      });
    } catch (error) {
      apiLogger.error('Failed to get user conversations', error as Error);

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // PUT /api/conversations/:conversationId/archive - Archive conversation
  fastify.put('/conversations/:conversationId/archive', {
    schema: {
      summary: 'Archive a conversation',
      description: 'Archives a conversation to remove it from active conversations',
      tags: ['Conversations'],
      params: {
        type: 'object',
        properties: {
          conversationId: { type: 'string', format: 'uuid' }
        }
      },
      response: {
        200: {
          description: 'Conversation archived successfully',
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
      const { conversationId } = getConversationParamsSchema.parse(request.params);

      await conversationManager.archiveConversation(conversationId);

      return reply.send({
        success: true,
        message: 'Conversation archived successfully'
      });
    } catch (error) {
      apiLogger.error('Failed to archive conversation', error as Error);

      if ((error as Error).message.includes('not found')) {
        return reply.status(404).send({
          success: false,
          error: 'Conversation not found'
        });
      }

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // GET /api/conversations/stats - Get conversation statistics
  fastify.get('/conversations/stats', {
    schema: {
      summary: 'Get conversation statistics',
      description: 'Retrieves overall conversation system statistics',
      tags: ['Conversations'],
      response: {
        200: {
          description: 'Conversation statistics',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalConversations: { type: 'number' },
                activeConversations: { type: 'number' },
                messagesProcessed: { type: 'number' },
                averageResponseTime: { type: 'number' },
                conversationsByStatus: {
                  type: 'object',
                  properties: {
                    ACTIVE: { type: 'number' },
                    ARCHIVED: { type: 'number' },
                    DELETED: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (_request, reply: FastifyReply) => {
    try {
      const stats = conversationManager.getStats();

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      apiLogger.error('Failed to get conversation stats', error as Error);

      return reply.status(500).send({
        success: false,
        error: (error as Error).message
      });
    }
  });
};

export default conversationsRoutes;