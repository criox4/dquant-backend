import { FastifyInstance } from 'fastify';
import { WebSocketConnection } from '@/types/fastify';
import { websocketLogger } from '@/services/logger';
import { WebSocketEvent } from '@/types/common';
import { setupSocketIOCompatibility, emitToSocketIORoom, emitToSocketIOUser, getSocketIOStats } from './socket-io-compatibility';

// Connection management
const connections = new Map<string, WebSocketConnection>();
const rooms = new Map<string, Set<string>>();

export async function setupWebSocket(app: FastifyInstance): Promise<void> {
  try {
    websocketLogger.info('Setting up WebSocket server');

    // Setup Socket.IO compatibility layer first
    await setupSocketIOCompatibility(app, {
      enabled: process.env.SOCKETIO_COMPATIBILITY !== 'false',
      cors: {
        origin: process.env.NODE_ENV === 'development'
          ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173']
          : process.env.FRONTEND_URLS?.split(',') || [],
        credentials: true
      }
    });

    // Register WebSocket plugin
    await app.register(import('@fastify/websocket'), {
      options: {
        maxPayload: 1048576, // 1MB
        verifyClient: (_info: any) => {
          // TODO: Add authentication verification
          return true;
        }
      }
    });

    // WebSocket route for main connection
    app.register(async function websocketRoutes(app) {
      app.get('/ws', { websocket: true }, async (connection, request) => {
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const clientIp = request.ip;

        websocketLogger.info('New WebSocket connection', {
          connectionId,
          ip: clientIp,
          userAgent: request.headers['user-agent'] as string | undefined
        });

        // Store connection
        const wsConnection: WebSocketConnection = {
          socket: connection.socket,
          rooms: new Set()
        };
        connections.set(connectionId, wsConnection);

        // Handle connection events
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await handleWebSocketMessage(connectionId, data);
          } catch (error) {
            websocketLogger.error('Error parsing WebSocket message', error as Error, {
              connectionId,
              message: message.toString()
            });

            // Send error response
            await sendToConnection(connectionId, {
              event: 'error',
              data: { message: 'Invalid message format' },
              timestamp: new Date().toISOString()
            });
          }
        });

        connection.socket.on('close', (code: number, reason: Buffer) => {
          websocketLogger.info('WebSocket connection closed', {
            connectionId,
            code,
            reason: reason.toString(),
            ip: clientIp
          });

          // Clean up connection
          cleanupConnection(connectionId);
        });

        connection.socket.on('error', (error: Error) => {
          websocketLogger.error('WebSocket connection error', error, {
            connectionId,
            ip: clientIp
          });

          // Clean up connection
          cleanupConnection(connectionId);
        });

        // Send welcome message
        await sendToConnection(connectionId, {
          event: 'connected',
          data: {
            connectionId,
            message: 'WebSocket connection established',
            features: [
              'real-time-data',
              'trading-updates',
              'strategy-notifications',
              'chat-streaming'
            ]
          },
          timestamp: new Date().toISOString()
        });
      });

      // WebSocket route for authenticated connections
      app.get('/ws/authenticated', { websocket: true }, async (connection, request) => {
        // TODO: Implement authentication check
        const userId = request.headers['x-user-id'] as string;

        if (!userId) {
          connection.socket.close(4001, 'Authentication required');
          return;
        }

        const connectionId = `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        websocketLogger.info('New authenticated WebSocket connection', {
          connectionId,
          userId,
          ip: request.ip
        });

        // Store authenticated connection
        const wsConnection: WebSocketConnection = {
          socket: connection.socket,
          userId,
          rooms: new Set()
        };
        connections.set(connectionId, wsConnection);

        // Handle authenticated connection events
        connection.socket.on('message', async (message: Buffer) => {
          try {
            const data = JSON.parse(message.toString());
            await handleAuthenticatedMessage(connectionId, data, userId);
          } catch (error) {
            websocketLogger.error('Error handling authenticated message', error as Error, {
              connectionId,
              userId
            });
          }
        });

        connection.socket.on('close', () => {
          cleanupConnection(connectionId);
        });

        // Send authenticated welcome
        await sendToConnection(connectionId, {
          event: 'authenticated',
          data: {
            connectionId,
            userId,
            message: 'Authenticated WebSocket connection established'
          },
          timestamp: new Date().toISOString()
        });
      });
    });

    websocketLogger.info('WebSocket server setup completed');

  } catch (error) {
    websocketLogger.error('Failed to setup WebSocket server', error as Error);
    throw error;
  }
}

// Handle general WebSocket messages
async function handleWebSocketMessage(connectionId: string, data: any): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) return;

  websocketLogger.debug('Received WebSocket message', {
    connectionId,
    event: data.event,
    dataKeys: Object.keys(data.data || {})
  });

  switch (data.event) {
    case 'ping':
      await sendToConnection(connectionId, {
        event: 'pong',
        data: { timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });
      break;

    case 'join_room':
      await joinRoom(connectionId, data.data.room);
      break;

    case 'leave_room':
      await leaveRoom(connectionId, data.data.room);
      break;

    case 'subscribe_market_data':
      // TODO: Implement market data subscription
      await sendToConnection(connectionId, {
        event: 'subscription_confirmed',
        data: { symbol: data.data.symbol, type: 'market_data' },
        timestamp: new Date().toISOString()
      });
      break;

    default:
      websocketLogger.warn('Unknown WebSocket event', {
        connectionId,
        event: data.event
      });
      break;
  }
}

// Handle authenticated WebSocket messages
async function handleAuthenticatedMessage(connectionId: string, data: any, userId: string): Promise<void> {
  websocketLogger.debug('Received authenticated message', {
    connectionId,
    userId,
    event: data.event
  });

  // Handle authenticated-specific events
  switch (data.event) {
    case 'join_user_room':
      await joinRoom(connectionId, `user_${userId}`);
      break;

    case 'join_conversation':
      if (data.data.conversationId) {
        await joinRoom(connectionId, `conversation_${data.data.conversationId}`);
        // Update connection with conversation ID
        const connection = connections.get(connectionId);
        if (connection) {
          connection.conversationId = data.data.conversationId;
        }
      }
      break;

    case 'subscribe_strategy_updates':
      if (data.data.strategyId) {
        await joinRoom(connectionId, `strategy_${data.data.strategyId}`);
      }
      break;

    case 'subscribe_trading_updates':
      await joinRoom(connectionId, `trading_${userId}`);
      break;

    default:
      // Fall back to general message handling
      await handleWebSocketMessage(connectionId, data);
      break;
  }
}

// Room management functions
async function joinRoom(connectionId: string, roomName: string): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.rooms.add(roomName);

  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName)!.add(connectionId);

  websocketLogger.debug('Connection joined room', {
    connectionId,
    roomName,
    roomSize: rooms.get(roomName)!.size
  });

  await sendToConnection(connectionId, {
    event: 'room_joined',
    data: { room: roomName },
    timestamp: new Date().toISOString()
  });
}

async function leaveRoom(connectionId: string, roomName: string): Promise<void> {
  const connection = connections.get(connectionId);
  if (!connection) return;

  connection.rooms.delete(roomName);

  const room = rooms.get(roomName);
  if (room) {
    room.delete(connectionId);
    if (room.size === 0) {
      rooms.delete(roomName);
    }
  }

  websocketLogger.debug('Connection left room', {
    connectionId,
    roomName,
    roomSize: room?.size || 0
  });

  await sendToConnection(connectionId, {
    event: 'room_left',
    data: { room: roomName },
    timestamp: new Date().toISOString()
  });
}

// Messaging functions
async function sendToConnection(connectionId: string, message: WebSocketEvent): Promise<boolean> {
  const connection = connections.get(connectionId);
  if (!connection || connection.socket.readyState !== connection.socket.OPEN) {
    return false;
  }

  try {
    connection.socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    websocketLogger.error('Error sending message to connection', error as Error, {
      connectionId
    });
    return false;
  }
}

async function broadcastToRoom(roomName: string, message: WebSocketEvent): Promise<number> {
  const room = rooms.get(roomName);
  let sentCount = 0;

  // Broadcast to native WebSocket connections
  if (room) {
    for (const connectionId of room) {
      const sent = await sendToConnection(connectionId, message);
      if (sent) sentCount++;
    }
  }

  // Also broadcast to Socket.IO clients for compatibility
  try {
    emitToSocketIORoom(roomName, message.event, message.data);
  } catch (error) {
    websocketLogger.warn('Failed to emit to Socket.IO room:', error);
  }

  websocketLogger.debug('Broadcast to room', {
    roomName,
    totalConnections: room?.size || 0,
    successfulSends: sentCount
  });

  return sentCount;
}

async function broadcastToUser(userId: string, message: WebSocketEvent): Promise<number> {
  const result = await broadcastToRoom(`user_${userId}`, message);

  // Also emit directly to Socket.IO user for compatibility
  try {
    emitToSocketIOUser(userId, message.event, message.data);
  } catch (error) {
    websocketLogger.warn('Failed to emit to Socket.IO user:', error);
  }

  return result;
}

// Connection cleanup
function cleanupConnection(connectionId: string): void {
  const connection = connections.get(connectionId);
  if (!connection) return;

  // Remove from all rooms
  for (const roomName of connection.rooms) {
    const room = rooms.get(roomName);
    if (room) {
      room.delete(connectionId);
      if (room.size === 0) {
        rooms.delete(roomName);
      }
    }
  }

  // Remove connection
  connections.delete(connectionId);

  websocketLogger.debug('Connection cleaned up', {
    connectionId,
    roomsLeft: connection.rooms.size
  });
}

// Statistics and monitoring
export function getWebSocketStats(): {
  totalConnections: number;
  authenticatedConnections: number;
  totalRooms: number;
  roomDistribution: Record<string, number>;
  socketIO: {
    totalConnections: number;
    roomDistribution: Record<string, number>;
  };
} {
  const authenticatedCount = Array.from(connections.values())
    .filter(conn => conn.userId).length;

  const roomDistribution: Record<string, number> = {};
  for (const [roomName, roomConnections] of rooms) {
    roomDistribution[roomName] = roomConnections.size;
  }

  const socketIOStats = getSocketIOStats();

  return {
    totalConnections: connections.size,
    authenticatedConnections: authenticatedCount,
    totalRooms: rooms.size,
    roomDistribution,
    socketIO: socketIOStats
  };
}

// Export functions for use by other services
export {
  sendToConnection,
  broadcastToRoom,
  broadcastToUser,
  connections,
  rooms
};