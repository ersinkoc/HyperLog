# @oxog/hyperlog

Ultra-fast, zero-dependency Node.js logger with advanced features for production use.

## Features

- **Blazing Fast**: 1M+ logs/second with minimal overhead
- **Zero Dependencies**: Everything implemented from scratch
- **Multiple Transports**: Console, file, HTTP, streams, syslog
- **Structured Logging**: First-class JSON support
- **File Rotation**: Size-based and time-based with compression
- **Child Loggers**: Hierarchical logging with inherited context
- **Async-Safe**: Non-blocking I/O for all operations
- **TypeScript Support**: Full type definitions included
- **Production Ready**: Battle-tested performance optimizations
- **Framework Integration**: Express & Fastify middleware included
- **CLI Tools**: Log analysis, conversion, and manipulation utilities
- **Syslog Support**: RFC3164 and RFC5424 compliant
- **Log Sampling**: Reduce log volume with configurable sampling
- **Rate Limiting**: Prevent log flooding with token bucket algorithm
- **Metrics & Analytics**: Built-in metrics aggregation and reporting
- **Adaptive Sampling**: Automatically adjust sampling based on throughput

## Installation

```bash
npm install @oxog/hyperlog
```

## Quick Start

```typescript
import hyperlog from '@oxog/hyperlog';

const logger = hyperlog.create({
  level: 'info',
  pretty: true
});

logger.info('Hello World');
logger.error({ err: new Error('Oops!') }, 'Something went wrong');
```

## API

### Creating a Logger

```typescript
const logger = hyperlog.create({
  level: 'info',           // minimum log level
  pretty: true,            // pretty print for development
  timestamp: true,         // include timestamps
  hostname: true,          // include hostname
  pid: true,              // include process ID
  transports: [],         // custom transports
  redact: ['password'],   // fields to redact
  filter: (entry) => true // custom filter function
});
```

### Log Levels

- `trace`
- `debug`
- `info`
- `warn`
- `error`
- `fatal`

### Basic Logging

```typescript
// Simple messages
logger.info('User logged in');

// With metadata
logger.info({ userId: 123 }, 'User logged in');

// Error logging
logger.error({ err: error }, 'Failed to process');
```

### Child Loggers

```typescript
const requestLogger = logger.child({ requestId: 'abc-123' });
requestLogger.info('Processing request');
// Output includes requestId in all logs
```

### Context Management

```typescript
logger.withContext({ userId: 123 }, () => {
  logger.info('User action');
  // All logs in this scope include userId
});
```

### Performance Timing

```typescript
const timer = logger.startTimer();
// ... do work ...
timer.done({ operation: 'database-query' }, 'Query completed');
// Logs include duration automatically
```

## Transports

### Console Transport

```typescript
new ConsoleTransport({
  level: 'debug',
  pretty: true,
  colors: true,
  timestamp: 'ISO8601'
})
```

### File Transport

```typescript
new FileTransport({
  filename: 'app.log',
  maxSize: '100MB',
  maxFiles: 10,
  compress: true,
  datePattern: 'YYYY-MM-DD'
})
```

### HTTP Transport

```typescript
new HTTPTransport({
  url: 'https://logs.example.com',
  batchSize: 100,
  flushInterval: 5000,
  retry: { attempts: 3, delay: 1000 }
})
```

### Stream Transport

```typescript
new StreamTransport({
  stream: process.stdout,
  format: 'json'
})
```

## Multiple Transports

```typescript
const logger = hyperlog.create({
  transports: [
    new ConsoleTransport({ level: 'debug' }),
    new FileTransport({ level: 'info', filename: 'app.log' }),
    new FileTransport({ level: 'error', filename: 'error.log' }),
    new HTTPTransport({ level: 'warn', url: 'https://logs.example.com' })
  ]
});
```

### Syslog Transport

```typescript
new SyslogTransport({
  host: 'localhost',
  port: 514,
  protocol: 'udp4',
  facility: SYSLOG_FACILITY.LOCAL0,
  tag: 'myapp',
  rfc3164: true
})
```

## Framework Integration

### Express Middleware

```typescript
app.use(hyperlog.expressLogger({
  logger,
  excludePaths: ['/health'],
  includeBody: true,
  includeQuery: true,
  includeHeaders: ['user-agent'],
  customProps: (req, res) => ({
    userId: req.user?.id
  })
}));
```

### Fastify Plugin

```typescript
fastify.register(hyperlog.fastifyLogger({
  logger,
  excludePaths: ['/metrics'],
  includeBody: true
}));
```

## CLI Tools

```bash
# Pretty print logs
hyperlog pretty app.log

# Tail logs with filtering
hyperlog tail -f app.log --level error --grep "database"

# Analyze log patterns
hyperlog analyze app.log

# Convert formats
hyperlog convert app.log --from json --to csv

# Extract time range
hyperlog extract app.log --from "2024-01-01" --to "2024-01-31"

# Performance analysis
hyperlog perf app.log --slow 1000
```

## Advanced Features

### Log Sampling

Reduce log volume in high-throughput scenarios:

```typescript
const logger = hyperlog.create({
  sampling: {
    enabled: true,
    rate: 0.1, // Sample 10% of logs
    adaptive: true // Automatically adjust rate
  }
});
```

### Rate Limiting

Prevent log flooding:

```typescript
const logger = hyperlog.create({
  rateLimit: {
    enabled: true,
    maxPerSecond: 1000,
    maxBurst: 2000
  }
});
```

### Metrics & Analytics

Built-in metrics collection:

```typescript
const logger = hyperlog.create({
  metrics: {
    enabled: true,
    interval: 10000 // Report every 10 seconds
  }
});

// Get metrics snapshot
const metrics = logger.getMetrics();
console.log(metrics.counts.total); // Total logs
console.log(metrics.throughput.current); // Current logs/sec
console.log(metrics.topErrors); // Most common errors
```

## Performance

Benchmarks on a typical development machine:

- Simple string logging: **1,000,000+ ops/sec**
- Object logging: **700,000+ ops/sec**
- Child logger: **750,000+ ops/sec**
- Memory usage: < 6MB for 1M logs
- With sampling (10%): **10,000,000+ ops/sec**

## Production Best Practices

1. **Use sampling in high-throughput services**: Enable adaptive sampling to automatically adjust based on load
2. **Configure rate limiting**: Prevent runaway logging from impacting performance
3. **Use appropriate transports**: Console for development, file/HTTP for production
4. **Enable metrics**: Monitor logging performance and errors
5. **Set up log rotation**: Prevent disk space issues with automatic rotation and compression

## License

MIT © Ersin Koç