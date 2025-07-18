import { Logger } from '../core/logger';
import { FastifyRequest, FastifyReply, FastifyInstance } from '../types/fastify';

export interface FastifyLoggerOptions {
  logger?: Logger;
  excludePaths?: string[];
  includeBody?: boolean;
  includeQuery?: boolean;
  includeHeaders?: string[];
  customProps?: (req: FastifyRequest, reply: FastifyReply) => Record<string, any>;
}

export function fastifyLogger(options: FastifyLoggerOptions = {}) {
  const {
    logger,
    excludePaths = [],
    includeBody = false,
    includeQuery = true,
    includeHeaders = [],
    customProps
  } = options;

  if (!logger) {
    throw new Error('Logger instance required');
  }

  return async function(fastify: FastifyInstance) {
    // Add request ID generation
    fastify.addHook('onRequest', async (request, reply) => {
      const requestId = (request.headers['x-request-id'] as string) || 
                       (request.headers['x-correlation-id'] as string) || 
                       generateRequestId();
      
      (request as any).requestId = requestId;
      reply.header('x-request-id', requestId);
    });

    // Main logging hook
    fastify.addHook('preHandler', async (request, reply) => {
      // Skip excluded paths
      if (excludePaths.some(path => request.url.startsWith(path))) {
        return;
      }

      const startTime = Date.now();
      const requestId = (request as any).requestId;

      // Create request logger with context
      const requestLogger = logger.child({
        requestId,
        method: request.method,
        url: request.url,
        ip: request.ip,
        hostname: request.hostname,
        userAgent: request.headers['user-agent']
      });

      // Attach logger to request
      (request as any).log = requestLogger;

      // Log request
      const requestData: Record<string, any> = {
        method: request.method,
        url: request.url,
        ip: request.ip
      };

      if (includeQuery && request.query && Object.keys(request.query).length > 0) {
        requestData.query = request.query;
      }

      if (includeBody && request.body) {
        requestData.body = sanitizeBody(request.body);
      }

      if (includeHeaders.length > 0) {
        requestData.headers = {};
        includeHeaders.forEach(header => {
          const value = request.headers[header.toLowerCase()];
          if (value) {
            requestData.headers[header] = value;
          }
        });
      }

      requestLogger.info(requestData, 'Incoming request');

      // Store start time and logger for response hook
      (reply as any).startTime = startTime;
      (reply as any).logger = requestLogger;
    });

    // Response logging hook
    fastify.addHook('onResponse', async (request, reply) => {
      const requestLogger = (reply as any).logger;
      const startTime = (reply as any).startTime;
      
      if (!requestLogger || !startTime) {
        return;
      }

      const duration = Date.now() - startTime;
      const responseData: Record<string, any> = {
        statusCode: reply.statusCode,
        duration
      };

      const contentLength = reply.getHeader('content-length');
      if (contentLength) {
        responseData.contentLength = contentLength;
      }

      if (customProps) {
        Object.assign(responseData, customProps(request, reply));
      }

      const level = reply.statusCode >= 500 ? 'error' : 
                   reply.statusCode >= 400 ? 'warn' : 
                   'info';

      requestLogger[level](responseData, 'Request completed');
    });

    // Error handling
    fastify.addHook('onError', async (request, reply, error) => {
      const requestLogger = (request as any).log || logger;
      requestLogger.error({ 
        err: error,
        statusCode: reply.statusCode 
      }, 'Request error');
    });
  };
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'api_key', 'apiKey'];

  const sanitizeObject = (obj: any) => {
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  sanitizeObject(sanitized);
  return sanitized;
}