import { FastifyInstance } from 'fastify';
import { config } from '@/config/environment';
import { requestLogger, securityLogger } from '@/services/logger';

export async function setupMiddleware(app: FastifyInstance): Promise<void> {
  // CORS configuration
  await app.register(import('@fastify/cors'), {
    origin: config.IS_DEVELOPMENT
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
      : [config.FRONTEND_URL],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-User-ID',
      'X-Session-ID'
    ]
  });

  // Security headers
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: config.IS_DEVELOPMENT ? false : {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  });

  // Rate limiting
  await app.register(import('@fastify/rate-limit'), {
    max: 1000, // Maximum requests per time window
    timeWindow: '15 minutes',
    skipOnError: true,
    keyGenerator: (request) => {
      return request.headers['x-forwarded-for'] as string ||
             request.headers['x-real-ip'] as string ||
             request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          limit: context.max,
          window: context.timeWindow,
          retryAfter: context.timeWindow
        },
        timestamp: new Date().toISOString()
      };
    },
    onExceeded: (request, key) => {
      securityLogger.warn('Rate limit exceeded', {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        url: request.url,
        method: request.method,
        key
      });
    }
  });

  // Request context middleware
  app.addHook('onRequest', async (request, reply) => {
    // Generate request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create request context
    request.context = {
      userId: request.headers['x-user-id'] as string,
      conversationId: request.headers['x-conversation-id'] as string,
      sessionId: request.headers['x-session-id'] as string || requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    // Add request ID to headers
    reply.header('X-Request-ID', requestId);

    // Log request
    requestLogger.logRequest(request.method, request.url, {
      requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: request.context.userId
    });
  });

  // Response timing and logging
  app.addHook('onResponse', async (request, reply) => {
    const responseTime = reply.elapsedTime;

    requestLogger.logResponse(reply.statusCode, responseTime, {
      requestId: request.context.sessionId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userId: request.context.userId
    });

    // Log slow requests
    if (responseTime > 1000) {
      requestLogger.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        responseTime: `${responseTime}ms`,
        statusCode: reply.statusCode,
        userId: request.context.userId
      });
    }
  });

  // Request body size validation
  app.addHook('preValidation', async (request, reply) => {
    const contentLength = request.headers['content-length'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      requestLogger.warn('Request body too large', {
        contentLength,
        maxSize,
        url: request.url,
        method: request.method,
        ip: request.ip
      });

      await reply.status(413).send({
        success: false,
        error: 'Request body too large',
        code: 'PAYLOAD_TOO_LARGE',
        details: {
          maxSize,
          actualSize: contentLength
        },
        timestamp: new Date().toISOString()
      });
    }
  });

  // Security headers for API responses
  app.addHook('onSend', async (request, reply, payload) => {
    // Add security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Add API version header
    reply.header('X-API-Version', '2.0.0');

    // Add timestamp header
    reply.header('X-Timestamp', new Date().toISOString());

    return payload;
  });

  // Graceful shutdown hook
  app.addHook('onClose', async (instance) => {
    requestLogger.info('Application shutting down gracefully');
  });
}