// Fastify type extensions and augmentations
import { FastifyRequest, FastifyReply } from 'fastify';
import { RequestContext, UUID } from './common';

// Augment Fastify's type definitions
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: UUID;
      email?: string;
      role?: string;
    };
    requestContext?: RequestContext;
  }

  interface FastifyInstance {
    // Add custom properties to Fastify instance if needed
    prisma: import('@prisma/client').PrismaClient;
    redis: import('redis').RedisClientType;
  }
}

// Custom request types
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: UUID;
    email: string;
    role: string;
  };
}

// Route handler types
export type RouteHandler<TParams = unknown, TQuery = unknown, TBody = unknown> = (
  request: FastifyRequest<{
    Params: TParams;
    Querystring: TQuery;
    Body: TBody;
  }>,
  reply: FastifyReply
) => Promise<void> | void;

export type AuthenticatedRouteHandler<TParams = unknown, TQuery = unknown, TBody = unknown> = (
  request: AuthenticatedRequest & FastifyRequest<{
    Params: TParams;
    Querystring: TQuery;
    Body: TBody;
  }>,
  reply: FastifyReply
) => Promise<void> | void;

// WebSocket handler types
export interface WebSocketConnection {
  socket: import('ws').WebSocket;
  userId?: UUID;
  conversationId?: UUID;
  rooms: Set<string>;
}

// Route schema definitions for OpenAPI/Swagger
export interface RouteSchema {
  description?: string;
  summary?: string;
  tags?: string[];
  params?: object;
  querystring?: object;
  body?: object;
  response?: {
    [statusCode: number]: object;
  };
  security?: Array<{ [key: string]: string[] }>;
}

// Plugin options
export interface PluginOptions {
  [key: string]: unknown;
}

// Server configuration
export interface ServerConfig {
  host: string;
  port: number;
  logger: boolean | object;
  trustProxy?: boolean;
}

// CORS configuration
export interface CorsConfig {
  origin: boolean | string | string[] | RegExp;
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
}

// Rate limiting configuration
export interface RateLimitConfig {
  max: number;
  timeWindow: string;
  skipOnError?: boolean;
  keyGenerator?: (request: FastifyRequest) => string;
}

// JWT configuration
export interface JWTConfig {
  secret: string;
  sign?: {
    algorithm?: string;
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
  };
  verify?: {
    algorithms?: string[];
    issuer?: string;
    audience?: string;
    maxAge?: string | number;
  };
}