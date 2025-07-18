const hyperlog = require('../dist');

// Create logger with advanced features
const logger = hyperlog.create({
  level: 'debug',
  pretty: true,
  
  // Enable sampling to reduce log volume
  sampling: {
    enabled: true,
    rate: 0.1, // Sample 10% of logs
    adaptive: true // Adjust rate based on throughput
  },
  
  // Rate limiting to prevent log flooding
  rateLimit: {
    enabled: true,
    maxPerSecond: 1000,
    maxBurst: 2000
  },
  
  // Metrics collection
  metrics: {
    enabled: true,
    interval: 10000 // Report every 10 seconds
  },
  
  // Multiple transports
  transports: [
    new hyperlog.ConsoleTransport({ pretty: true }),
    
    // File transport with rotation
    new hyperlog.FileTransport({
      filename: 'logs/app.log',
      maxSize: '50MB',
      maxFiles: 10,
      compress: true
    }),
    
    // HTTP transport for centralized logging
    new hyperlog.HTTPTransport({
      url: 'https://logs.example.com/ingest',
      batchSize: 100,
      flushInterval: 5000,
      retry: { attempts: 3, delay: 1000, backoff: 2 }
    })
  ]
});

// Example: High-throughput logging scenario
console.log('Starting high-throughput logging test...\n');

// Simulate high-frequency logging
let requestCount = 0;
const interval = setInterval(() => {
  for (let i = 0; i < 100; i++) {
    requestCount++;
    
    // This will be sampled and rate-limited
    logger.debug({
      requestId: `req-${requestCount}`,
      method: 'GET',
      path: '/api/users',
      duration: Math.random() * 100
    }, 'API request');
    
    // Simulate some errors
    if (Math.random() < 0.05) {
      logger.error({
        err: new Error('Database connection timeout'),
        requestId: `req-${requestCount}`
      }, 'Request failed');
    }
  }
}, 10);

// Example: Context propagation with sampling
logger.withContext({ service: 'api', version: '2.0.0' }, () => {
  logger.info('Service started with context');
  
  // Child logger inherits sampling and rate limiting
  const dbLogger = logger.child({ component: 'database' });
  
  for (let i = 0; i < 1000; i++) {
    dbLogger.debug({ query: `SELECT * FROM users WHERE id = ${i}` }, 'Executing query');
  }
});

// Example: Performance tracking
async function performOperation() {
  const timer = logger.startTimer();
  
  // Simulate work
  await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
  
  timer.done({
    operation: 'data-processing',
    records: Math.floor(Math.random() * 1000)
  }, 'Operation completed');
}

// Run many operations
for (let i = 0; i < 50; i++) {
  performOperation();
}

// Example: Structured error logging
class CustomError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
    this.details = details;
  }
}

try {
  throw new CustomError('Payment processing failed', 'PAYMENT_FAILED', {
    userId: 12345,
    amount: 99.99,
    currency: 'USD'
  });
} catch (error) {
  logger.error({
    err: error,
    transaction: 'tx-12345'
  }, 'Transaction failed');
}

// Example: Log metrics reporting
if (logger.getMetrics) {
  setInterval(() => {
    const metrics = logger.getMetrics();
    console.log('\n=== Logger Metrics ===');
    console.log(`Total logs: ${metrics.counts.total}`);
    console.log(`Dropped logs: ${metrics.counts.dropped}`);
    console.log(`Current throughput: ${metrics.throughput.current} logs/sec`);
    console.log(`Average throughput: ${metrics.throughput.avg} logs/sec`);
    console.log('Log levels:', metrics.counts.byLevel);
    
    if (metrics.topErrors.length > 0) {
      console.log('\nTop errors:');
      metrics.topErrors.forEach(error => {
        console.log(`  ${error.count}x ${error.message}`);
      });
    }
    
    if (metrics.performance.avgDuration) {
      console.log('\nPerformance:');
      console.log(`  Avg duration: ${metrics.performance.avgDuration.toFixed(2)}ms`);
      console.log(`  P95 duration: ${metrics.performance.p95Duration.toFixed(2)}ms`);
      console.log(`  P99 duration: ${metrics.performance.p99Duration.toFixed(2)}ms`);
    }
    console.log('==================\n');
  }, 5000);
}

// Cleanup after 30 seconds
setTimeout(async () => {
  clearInterval(interval);
  console.log('\nStopping test...');
  
  // Final metrics
  if (logger.getMetrics) {
    const finalMetrics = logger.getMetrics();
    console.log('\nFinal Statistics:');
    console.log(`Total logs attempted: ${requestCount * 2}`); // requests + queries
    console.log(`Total logs written: ${finalMetrics.counts.total}`);
    console.log(`Total logs dropped: ${finalMetrics.counts.dropped}`);
    console.log(`Sampling rate: ${(finalMetrics.counts.total / (requestCount * 2) * 100).toFixed(1)}%`);
  }
  
  await logger.close();
  process.exit(0);
}, 30000);