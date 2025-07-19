import { Logger } from '../core/logger';
import { Request, Response, NextFunction } from '../types/express';

export interface ExpressLoggerOptions {
  logger?: Logger;
  excludePaths?: string[];
  includeBody?: boolean;
  includeQuery?: boolean;
  includeHeaders?: string[];
  customProps?: (req: Request, res: Response) => Record<string, any>;
}

export function expressLogger(options: ExpressLoggerOptions = {}) {
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

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || 
                     req.headers['x-correlation-id'] || 
                     generateRequestId();

    // Create request logger with context
    const requestLogger = logger.child({
      requestId,
      method: req.method,
      url: req.url,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Attach logger to request
    (req as any).log = requestLogger;
    (req as any).requestId = requestId;

    // Log request
    const requestData: Record<string, any> = {
      method: req.method,
      url: req.url,
      path: req.path || req.url,
      ip: req.ip || (req as any).socket?.remoteAddress
    };

    if (includeQuery && Object.keys(req.query).length > 0) {
      requestData.query = req.query;
    }

    if (includeBody && req.body !== undefined) {
      if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length === 0) {
        // Skip empty objects
      } else {
        requestData.body = sanitizeBody(req.body);
      }
    }

    if (includeHeaders.length > 0) {
      requestData.headers = {};
      includeHeaders.forEach(header => {
        const value = req.headers[header.toLowerCase()];
        if (value) {
          requestData.headers[header] = value;
        }
      });
    }

    requestLogger.info(requestData, 'Incoming request');

    // Capture response
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(data: any) {
      return originalSend.call(this, data);
    };

    res.json = function(data: any) {
      return originalJson.call(this, data);
    };

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseData: Record<string, any> = {
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length')
      };

      if (customProps) {
        Object.assign(responseData, customProps(req, res));
      }

      const level = res.statusCode >= 500 ? 'error' : 
                   res.statusCode >= 400 ? 'warn' : 
                   'info';

      requestLogger[level](responseData, 'Request completed');
    });

    // Error handling
    res.on('error', (err) => {
      requestLogger.error({ err }, 'Response error');
    });

    next();
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
  const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'api_key', 'apikey'];

  const sanitizeObject = (obj: any) => {
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  sanitizeObject(sanitized);
  return sanitized;
}