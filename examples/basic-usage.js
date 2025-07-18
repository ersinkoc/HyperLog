const hyperlog = require('../dist');

// Create a basic logger
const logger = hyperlog.create({
  level: 'debug',
  pretty: true,
  timestamp: true
});

// Basic logging
logger.info('Application started');
logger.debug({ port: 3000 }, 'Server listening');

// Error logging
try {
  throw new Error('Something went wrong!');
} catch (error) {
  logger.error({ err: error }, 'Failed to process request');
}

// Structured logging
logger.info({
  userId: 123,
  action: 'login',
  ip: '192.168.1.1'
}, 'User logged in');

// Child loggers
const dbLogger = logger.child({ component: 'database' });
dbLogger.info({ query: 'SELECT * FROM users' }, 'Executing query');

// Context propagation
logger.withContext({ requestId: 'abc-123' }, () => {
  logger.info('Processing request');
  // All logs within this context will have requestId
  processRequest();
});

function processRequest() {
  logger.debug('Inside processRequest');
  logger.info({ step: 1 }, 'Validating input');
  logger.info({ step: 2 }, 'Querying database');
}

// Performance timing
const timer = logger.startTimer();
setTimeout(() => {
  timer.done({ operation: 'data-processing' }, 'Data processing complete');
}, 100);