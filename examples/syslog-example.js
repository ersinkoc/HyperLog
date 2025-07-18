// Example of using HyperLog with Syslog transport
const hyperlog = require('../dist');

// Create logger with syslog transport
const logger = hyperlog.create({
  level: 'debug',
  transports: [
    // Console for local viewing
    new hyperlog.ConsoleTransport({ 
      pretty: true 
    }),
    
    // Syslog for centralized logging
    new hyperlog.SyslogTransport({
      host: 'localhost',
      port: 514,
      facility: hyperlog.SYSLOG_FACILITY.LOCAL0,
      tag: 'myapp',
      rfc3164: true
    })
  ]
});

// Log various levels
logger.info('Application started');
logger.debug({ config: { env: 'production' } }, 'Configuration loaded');

// Log with structured data
logger.info({
  userId: 12345,
  action: 'purchase',
  amount: 99.99,
  items: ['item-1', 'item-2']
}, 'Purchase completed');

// Error logging
try {
  throw new Error('Database connection failed');
} catch (error) {
  logger.error({ err: error, retry: 3 }, 'Failed to connect to database');
}

// Child logger for specific component
const dbLogger = logger.child({ component: 'database' });
dbLogger.info('Executing migration');
dbLogger.debug({ tables: ['users', 'orders'] }, 'Migration completed');

// Performance tracking
const timer = logger.startTimer();
setTimeout(() => {
  timer.done({ operation: 'batch-job', records: 1000 }, 'Batch job completed');
}, 500);

// Different syslog facilities for different components
const authLogger = hyperlog.create({
  transports: [
    new hyperlog.SyslogTransport({
      facility: hyperlog.SYSLOG_FACILITY.AUTH,
      tag: 'auth'
    })
  ]
});

authLogger.info({ userId: 123, ip: '192.168.1.1' }, 'User login successful');
authLogger.warn({ userId: 456, attempts: 3 }, 'Multiple failed login attempts');

// Graceful shutdown
setTimeout(async () => {
  logger.info('Shutting down application');
  await logger.close();
  await authLogger.close();
  process.exit(0);
}, 2000);