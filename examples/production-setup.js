/**
 * Production-ready HyperLog setup example
 * This demonstrates a complete logging setup for production applications
 */

const hyperlog = require('../dist');
const path = require('path');

// Create production logger with all features
const logger = hyperlog.create({
  level: process.env.LOG_LEVEL || 'info',
  name: 'my-app',
  timestamp: true,
  hostname: true,
  pid: true,
  
  // Sampling configuration
  sampling: {
    enabled: process.env.NODE_ENV === 'production',
    rate: 0.1, // Sample 10% in production
    adaptive: true // Automatically adjust based on load
  },
  
  // Rate limiting
  rateLimit: {
    enabled: true,
    maxPerSecond: 1000,
    maxBurst: 2000
  },
  
  // Metrics collection
  metrics: {
    enabled: true,
    interval: 60000 // Report every minute
  },
  
  // Sensitive data redaction
  redact: ['password', 'token', 'secret', 'authorization', 'api_key', 'credit_card'],
  
  // Custom filter
  filter: (entry) => {
    // Filter out health check logs in production
    if (process.env.NODE_ENV === 'production') {
      return !entry.path || !entry.path.includes('/health');
    }
    return true;
  },
  
  // Multiple transports for different purposes
  transports: [
    // Console for development and debugging
    new hyperlog.ConsoleTransport({
      pretty: process.env.NODE_ENV !== 'production',
      colors: true
    }),
    
    // Main application log file
    new hyperlog.FileTransport({
      filename: path.join('logs', 'app.log'),
      maxSize: '100MB',
      maxFiles: 10,
      compress: true,
      datePattern: 'YYYY-MM-DD',
      bufferSize: 4096,
      flushInterval: 1000
    }),
    
    // Error log file
    new hyperlog.FileTransport({
      level: 'error',
      filename: path.join('logs', 'error.log'),
      maxSize: '50MB',
      maxFiles: 30, // Keep errors longer
      compress: true
    }),
    
    // Audit log for important events
    new hyperlog.FileTransport({
      level: 'info',
      filename: path.join('logs', 'audit.log'),
      format: (entry) => {
        // Custom format for audit logs
        if (entry.audit) {
          return JSON.stringify({
            timestamp: new Date(entry.time).toISOString(),
            user: entry.userId,
            action: entry.action,
            resource: entry.resource,
            result: entry.result,
            ip: entry.ip
          });
        }
        return null;
      }
    }),
    
    // Send critical errors to monitoring service
    new hyperlog.HTTPTransport({
      level: 'error',
      url: process.env.LOG_ENDPOINT || 'https://logs.example.com/ingest',
      headers: {
        'Authorization': `Bearer ${process.env.LOG_API_KEY}`,
        'X-Service-Name': 'my-app'
      },
      batchSize: 50,
      flushInterval: 5000,
      retry: {
        attempts: 3,
        delay: 1000,
        backoff: 2
      }
    }),
    
    // Syslog for system integration
    new hyperlog.SyslogTransport({
      level: 'warn',
      host: process.env.SYSLOG_HOST || 'localhost',
      port: 514,
      facility: hyperlog.SYSLOG_FACILITY.LOCAL0,
      tag: 'my-app'
    })
  ]
});

// Create specialized loggers for different components
const dbLogger = logger.child({ component: 'database' });
const apiLogger = logger.child({ component: 'api' });
const authLogger = logger.child({ component: 'auth' });

// Example: Database operations logging
async function queryDatabase(sql, params) {
  const timer = dbLogger.startTimer();
  
  try {
    dbLogger.debug({ sql, params }, 'Executing query');
    
    // Simulate database query
    const result = {
      rows: [{ id: 1, name: 'test' }],
      cached: false
    };
    
    timer.done({
      sql,
      rows: result.rows.length,
      cached: result.cached || false
    }, 'Query completed');
    
    return result;
  } catch (error) {
    dbLogger.error({
      err: error,
      sql,
      params
    }, 'Query failed');
    throw error;
  }
}

// Example: API request logging
function logApiRequest(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateId();
  const requestLogger = apiLogger.child({
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  req.log = requestLogger;
  req.requestId = requestId;
  
  const start = Date.now();
  
  // Log request
  requestLogger.info({
    query: req.query,
    headers: sanitizeHeaders(req.headers)
  }, 'Incoming request');
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' :
                  res.statusCode >= 400 ? 'warn' : 'info';
    
    requestLogger[level]({
      statusCode: res.statusCode,
      duration,
      contentLength: res.get('content-length')
    }, 'Request completed');
  });
  
  next();
}

// Example: Authentication logging
function logAuthentication(userId, success, metadata = {}) {
  const entry = {
    audit: true,
    userId,
    action: 'authentication',
    result: success ? 'success' : 'failure',
    ip: metadata.ip,
    ...metadata
  };
  
  if (success) {
    authLogger.info(entry, 'User authenticated');
  } else {
    authLogger.warn(entry, 'Authentication failed');
  }
}

// Example: Performance monitoring (one-time demo)
function demonstrateMetrics() {
  // Generate some sample logs first
  logger.info('Sample log 1');
  logger.warn('Sample warning');
  logger.error('Sample error');
  
  // Show metrics after brief delay
  setTimeout(() => {
    const metrics = logger.getMetrics();
    
    if (metrics) {
      // Log performance metrics
      logger.info({
        metrics: {
          totalLogs: metrics.counts.total,
          droppedLogs: metrics.counts.dropped,
          errorRate: metrics.counts.errors / metrics.counts.total,
          throughput: metrics.throughput.current,
          topErrors: metrics.topErrors.slice(0, 5)
        }
      }, 'Logger performance metrics (demo)');
    }
    
    // Demonstrate graceful shutdown
    demonstrateShutdown();
  }, 100);
}

// Example: Graceful shutdown (demonstration)
async function demonstrateShutdown() {
  logger.info('Demonstrating graceful shutdown');
  
  try {
    // Simulate stopping server
    logger.info('Stopping server (simulated)');
    
    // Simulate closing database connections
    logger.info('Closing database connections (simulated)');
    
    // Flush and close all loggers
    logger.info('Flushing logs');
    await logger.close();
    
    logger.info('Shutdown complete');
  } catch (error) {
    logger.fatal({ err: error }, 'Error during shutdown');
  }
}

// Helper functions
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitive = ['authorization', 'cookie', 'x-api-key'];
  
  sensitive.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// Run demonstration
demonstrateMetrics();

// Export configured logger
module.exports = {
  logger,
  dbLogger,
  apiLogger,
  authLogger,
  logApiRequest,
  logAuthentication
};