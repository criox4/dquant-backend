import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger, securityLogger } from '@/services/logger';
import { config } from '@/config/environment';

// Custom error classes
export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'External service error') {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', { service });
    this.name = 'ExternalServiceError';
  }
}

// Error handler function
export async function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const timestamp = new Date().toISOString();
  const requestId = (request as any).requestContext?.sessionId || 'unknown';

  // Log error with context
  const errorContext = {
    requestId,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    userId: (request as any).requestContext?.userId,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  };

  // Handle different error types
  if (error instanceof AppError) {
    // Custom application errors
    logger.warn(`Application error: ${error.message}`, errorContext);

    await reply.status(error.statusCode).send({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      timestamp
    });
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    logger.warn('Validation error', {
      ...errorContext,
      validationErrors: error.errors
    });

    await reply.status(400).send({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code
      })),
      timestamp
    });
    return;
  }

  // Prisma database errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error('Database error', error, errorContext);

    let statusCode = 500;
    let message = 'Database error';
    let code = 'DATABASE_ERROR';

    switch (error.code) {
      case 'P2002':
        statusCode = 409;
        message = 'Resource already exists';
        code = 'UNIQUE_CONSTRAINT_ERROR';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Resource not found';
        code = 'NOT_FOUND_ERROR';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Foreign key constraint failed';
        code = 'FOREIGN_KEY_ERROR';
        break;
      default:
        break;
    }

    await reply.status(statusCode).send({
      success: false,
      error: message,
      code,
      ...(config.IS_DEVELOPMENT && { details: error.meta }),
      timestamp
    });
    return;
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    logger.warn('Request validation error', errorContext);

    await reply.status(400).send({
      success: false,
      error: 'Request validation failed',
      code: 'REQUEST_VALIDATION_ERROR',
      details: error.validation,
      timestamp
    });
    return;
  }

  // Authentication errors
  if (error.message?.includes('Unauthorized') || error.message?.includes('Authentication')) {
    securityLogger.warn('Authentication error', errorContext);

    await reply.status(401).send({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_ERROR',
      timestamp
    });
    return;
  }

  // Rate limit errors
  if (error.message?.includes('Rate limit')) {
    securityLogger.warn('Rate limit exceeded', errorContext);

    await reply.status(429).send({
      success: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_ERROR',
      timestamp
    });
    return;
  }

  // Timeout errors
  if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
    logger.error('Request timeout', error, errorContext);

    await reply.status(408).send({
      success: false,
      error: 'Request timeout',
      code: 'TIMEOUT_ERROR',
      timestamp
    });
    return;
  }

  // Connection errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
    logger.error('Connection error', error, errorContext);

    await reply.status(502).send({
      success: false,
      error: 'Service unavailable',
      code: 'CONNECTION_ERROR',
      timestamp
    });
    return;
  }

  // Generic server errors
  logger.error('Unhandled server error', error, errorContext);

  const statusCode = (error as FastifyError).statusCode || 500;

  await reply.status(statusCode).send({
    success: false,
    error: config.IS_PRODUCTION
      ? 'Internal server error'
      : error.message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(config.IS_DEVELOPMENT && {
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }),
    timestamp
  });
}

// Error factory functions for common errors
export const createValidationError = (message: string, details?: unknown): ValidationError => {
  return new ValidationError(message, details);
};

export const createNotFoundError = (resource: string, id?: string): NotFoundError => {
  const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
  return new NotFoundError(message);
};

export const createConflictError = (resource: string, field?: string): ConflictError => {
  const message = field
    ? `${resource} with this ${field} already exists`
    : `${resource} already exists`;
  return new ConflictError(message);
};

export const createExternalServiceError = (service: string, message?: string): ExternalServiceError => {
  return new ExternalServiceError(service, message);
};

// Async error handler wrapper
export const asyncHandler = <TParams = unknown, TQuery = unknown, TBody = unknown>(
  fn: (
    request: FastifyRequest<{
      Params: TParams;
      Querystring: TQuery;
      Body: TBody;
    }>,
    reply: FastifyReply
  ) => Promise<void>
) => {
  return async (
    request: FastifyRequest<{
      Params: TParams;
      Querystring: TQuery;
      Body: TBody;
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      await fn(request, reply);
    } catch (error) {
      throw error; // Let the global error handler catch it
    }
  };
};