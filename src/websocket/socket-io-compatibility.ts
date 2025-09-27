/**
 * Socket.IO Compatibility Layer
 *
 * This module provides Socket.IO compatibility for legacy frontend clients
 * while maintaining the new Fastify WebSocket infrastructure underneath.
 */

import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { websocketLogger } from '@/services/logger';
import { broadcastToRoom, broadcastToUser, connections } from '@/websocket/server';

interface SocketIOCompatibilityOptions {
  enabled: boolean;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  path?: string;
}

// Socket.IO server instance
let ioServer: SocketIOServer | null = null;

// Active Socket.IO connections
const socketConnections = new Map<string, any>();

export async function setupSocketIOCompatibility(
  app: FastifyInstance,
  options: SocketIOCompatibilityOptions = { enabled: true }
): Promise<void> {
  if (!options.enabled) {
    websocketLogger.info('Socket.IO compatibility layer disabled');
    return;
  }

  try {
    websocketLogger.info('Setting up Socket.IO compatibility layer');

    // Register Socket.IO plugin
    await app.register(require('fastify-socket.io'), {
      cors: options.cors || {
        origin: process.env.NODE_ENV === 'development'
          ? ['http://localhost:3000', 'http://localhost:3001']
          : false,
        credentials: true
      },
      path: options.path || '/socket.io/',
      transports: ['websocket', 'polling'],
      allowEIO3: true // Support Socket.IO v3 clients
    });

    // Get Socket.IO server instance after registration
    app.ready((err) => {
      if (err) {
        websocketLogger.error('Failed to initialize Socket.IO:', err);
        return;
      }

      ioServer = app.io;
      setupSocketIOHandlers();
    });

    websocketLogger.info('Socket.IO compatibility layer configured');

  } catch (error) {
    websocketLogger.error('Failed to setup Socket.IO compatibility:', error as Error);
    throw error;
  }
}

function setupSocketIOHandlers(): void {
  if (!ioServer) {
    websocketLogger.error('Socket.IO server not available for handler setup');
    return;
  }

  ioServer.on('connection', (socket) => {
    const socketId = socket.id;
    const clientIp = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];

    websocketLogger.info('Socket.IO client connected', {
      socketId,
      ip: clientIp,
      userAgent
    });

    // Store socket connection
    socketConnections.set(socketId, socket);

    // Legacy compatibility: map Socket.IO events to WebSocket events

    // Handle legacy ping/pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle room joining (legacy compatibility)
    socket.on('join', (data: { room?: string; userId?: string; conversationId?: string }) => {
      websocketLogger.debug('Socket.IO join request:', data);

      if (data.room) {
        socket.join(data.room);
        socket.emit('joined', { room: data.room });
      }

      if (data.userId) {
        const userRoom = `user_${data.userId}`;
        socket.join(userRoom);
        socket.emit('joined', { room: userRoom });
      }

      if (data.conversationId) {
        const conversationRoom = `conversation_${data.conversationId}`;
        socket.join(conversationRoom);
        socket.emit('joined', { room: conversationRoom });
      }
    });

    // Handle room leaving
    socket.on('leave', (data: { room: string }) => {
      websocketLogger.debug('Socket.IO leave request:', data);
      socket.leave(data.room);
      socket.emit('left', { room: data.room });
    });

    // Handle legacy trading subscription events
    socket.on('subscribe', (data: { type: string; symbol?: string; strategyId?: string }) => {
      websocketLogger.debug('Socket.IO subscribe request:', data);

      switch (data.type) {
        case 'market_data':
          if (data.symbol) {
            socket.join(`market_${data.symbol}`);
            socket.emit('subscribed', { type: 'market_data', symbol: data.symbol });
          }
          break;

        case 'strategy_updates':
          if (data.strategyId) {
            socket.join(`strategy_${data.strategyId}`);
            socket.emit('subscribed', { type: 'strategy_updates', strategyId: data.strategyId });
          }
          break;

        case 'trading_updates':
          socket.join('trading_updates');
          socket.emit('subscribed', { type: 'trading_updates' });
          break;

        case 'paper_trading':
          socket.join('paper_trading');
          socket.emit('subscribed', { type: 'paper_trading' });
          break;

        default:
          websocketLogger.warn('Unknown subscription type:', data.type);
          socket.emit('error', { message: 'Unknown subscription type' });
      }
    });

    // Handle unsubscribe events
    socket.on('unsubscribe', (data: { type: string; symbol?: string; strategyId?: string }) => {
      websocketLogger.debug('Socket.IO unsubscribe request:', data);

      switch (data.type) {
        case 'market_data':
          if (data.symbol) {
            socket.leave(`market_${data.symbol}`);
            socket.emit('unsubscribed', { type: 'market_data', symbol: data.symbol });
          }
          break;

        case 'strategy_updates':
          if (data.strategyId) {
            socket.leave(`strategy_${data.strategyId}`);
            socket.emit('unsubscribed', { type: 'strategy_updates', strategyId: data.strategyId });
          }
          break;

        case 'trading_updates':
          socket.leave('trading_updates');
          socket.emit('unsubscribed', { type: 'trading_updates' });
          break;

        case 'paper_trading':
          socket.leave('paper_trading');
          socket.emit('unsubscribed', { type: 'paper_trading' });
          break;
      }
    });

    // Handle legacy paper trading events
    socket.on('paper_trade', (data: any) => {
      websocketLogger.debug('Socket.IO paper trade event:', data);

      // Emit to paper trading room
      ioServer?.to('paper_trading').emit('paper_trade_update', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    // Handle legacy tool approval events
    socket.on('tool_approve', (data: { callId: string; overrides?: any }) => {
      websocketLogger.debug('Socket.IO tool approval:', data);

      // This would integrate with the tool approval service
      socket.emit('tool_approved', {
        callId: data.callId,
        status: 'approved',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('tool_reject', (data: { callId: string; feedback?: string }) => {
      websocketLogger.debug('Socket.IO tool rejection:', data);

      socket.emit('tool_rejected', {
        callId: data.callId,
        status: 'rejected',
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      websocketLogger.info('Socket.IO client disconnected', {
        socketId,
        reason,
        ip: clientIp
      });

      // Clean up
      socketConnections.delete(socketId);
    });

    // Handle errors
    socket.on('error', (error) => {
      websocketLogger.error('Socket.IO client error:', error, {
        socketId,
        ip: clientIp
      });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Socket.IO compatibility layer active',
      socketId,
      timestamp: new Date().toISOString(),
      features: [
        'legacy-compatibility',
        'real-time-trading',
        'strategy-updates',
        'market-data',
        'tool-approvals'
      ]
    });
  });

  websocketLogger.info('Socket.IO event handlers configured');
}

// Bridge functions to connect Socket.IO with native WebSocket events

export function emitToSocketIORoom(roomName: string, event: string, data: any): void {
  if (!ioServer) {
    websocketLogger.warn('Socket.IO server not available for room emission');
    return;
  }

  ioServer.to(roomName).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });

  websocketLogger.debug('Emitted to Socket.IO room', {
    roomName,
    event,
    connectedSockets: ioServer.sockets.adapter.rooms.get(roomName)?.size || 0
  });
}

export function emitToSocketIOUser(userId: string, event: string, data: any): void {
  emitToSocketIORoom(`user_${userId}`, event, data);
}

export function getSocketIOStats(): {
  totalConnections: number;
  roomDistribution: Record<string, number>;
} {
  if (!ioServer) {
    return {
      totalConnections: 0,
      roomDistribution: {}
    };
  }

  const roomDistribution: Record<string, number> = {};
  for (const [roomName, room] of ioServer.sockets.adapter.rooms) {
    roomDistribution[roomName] = room.size;
  }

  return {
    totalConnections: ioServer.sockets.sockets.size,
    roomDistribution
  };
}

// Integration with existing WebSocket system
export function bridgeWebSocketToSocketIO(): void {
  // This function would integrate the new WebSocket events with Socket.IO
  // For now, it's a placeholder for future integration needs
  websocketLogger.info('WebSocket to Socket.IO bridge available');
}

export {
  ioServer,
  socketConnections
};