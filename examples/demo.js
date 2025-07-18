const { create } = require('../dist');

// Create logger with pretty printing
const logger = create({
  level: 'debug',
  pretty: true,
  timestamp: true,
  pid: true
});

// Basic logging examples
logger.info('🚀 HyperLog demo started');
logger.debug({ config: { port: 3000, env: 'development' } }, 'Configuration loaded');

// Error logging
try {
  throw new Error('Database connection failed');
} catch (error) {
  logger.error({ err: error, retry: 3 }, 'Failed to connect to database');
}

// Structured logging
logger.info({
  userId: 12345,
  action: 'purchase',
  amount: 99.99,
  currency: 'USD',
  items: ['item-1', 'item-2']
}, 'Purchase completed');

// Child logger with context
const apiLogger = logger.child({ component: 'api', version: '1.0.0' });
apiLogger.info({ endpoint: '/users', method: 'GET' }, 'API request received');

// Performance timing
const timer = logger.startTimer();
setTimeout(() => {
  timer.done({ 
    operation: 'data-processing',
    records: 1000 
  }, 'Batch processing completed');
}, 100);

// Context propagation
logger.withContext({ requestId: 'req-abc-123' }, () => {
  logger.info('Starting request processing');
  logger.debug({ step: 1 }, 'Validating input');
  logger.debug({ step: 2 }, 'Querying database');
  logger.info('Request completed successfully');
});