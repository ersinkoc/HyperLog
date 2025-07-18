# HyperLog API Reference

## Table of Contents

- [Creating a Logger](#creating-a-logger)
- [Log Levels](#log-levels)
- [Logger Methods](#logger-methods)
- [Child Loggers](#child-loggers)
- [Context Management](#context-management)
- [Transports](#transports)
- [Formatters](#formatters)
- [Advanced Features](#advanced-features)
- [Utilities](#utilities)

## Creating a Logger

### `hyperlog.create(options?: LoggerOptions): Logger`

Creates a new logger instance with the specified options.

```typescript
import hyperlog from '@oxog/hyperlog';

const logger = hyperlog.create({
  level: 'info',
  pretty: true,
  timestamp: true
});
```

### LoggerOptions

```typescript
interface LoggerOptions {
  level?: LogLevel;                    // Minimum log level (default: 'info')
  name?: string;                       // Logger name
  pretty?: boolean;                    // Pretty print (default: NODE_ENV === 'development')
  timestamp?: boolean;                 // Include timestamp (default: true)
  hostname?: boolean;                  // Include hostname (default: false)
  pid?: boolean;                       // Include process ID (default: false)
  transports?: Transport[];            // Log transports (default: ConsoleTransport)
  context?: Record<string, any>;       // Default context
  redact?: string[];                   // Fields to redact
  filter?: (entry: LogEntry) => boolean; // Custom filter function
  sampling?: {                         // Log sampling configuration
    enabled: boolean;
    rate: number;                      // 0-1 (e.g., 0.1 = 10%)
    adaptive?: boolean;
  };
  rateLimit?: {                        // Rate limiting configuration
    enabled: boolean;
    maxPerSecond: number;
    maxBurst?: number;
  };
  metrics?: {                          // Metrics collection
    enabled: boolean;
    interval?: number;                 // Report interval in ms
  };
}
```

## Log Levels

Available log levels in order of severity:

- `trace` (10)
- `debug` (20)
- `info` (30)
- `warn` (40)
- `error` (50)
- `fatal` (60)

## Logger Methods

### Logging Methods

```typescript
logger.trace(obj: any, msg?: string): void
logger.debug(obj: any, msg?: string): void
logger.info(obj: any, msg?: string): void
logger.warn(obj: any, msg?: string): void
logger.error(obj: any, msg?: string): void
logger.fatal(obj: any, msg?: string): void
```

Examples:
```typescript
// Simple message
logger.info('Server started');

// With metadata
logger.info({ port: 3000 }, 'Server started');

// Error logging
logger.error({ err: error }, 'Request failed');
```

### Configuration Methods

#### `logger.setLevel(level: LogLevel): void`

Changes the minimum log level.

```typescript
logger.setLevel('debug');
```

#### `logger.addTransport(transport: Transport): void`

Adds a new transport to the logger.

```typescript
logger.addTransport(new FileTransport({ filename: 'app.log' }));
```

#### `logger.removeTransport(transport: Transport): void`

Removes a transport from the logger.

### Utility Methods

#### `logger.startTimer(): Timer`

Creates a timer for measuring operation duration.

```typescript
const timer = logger.startTimer();
// ... perform operation ...
timer.done({ operation: 'database-query' }, 'Query completed');
// Logs: { operation: 'database-query', duration: 123 }
```

#### `logger.close(): Promise<void>`

Closes all transports and cleans up resources.

```typescript
await logger.close();
```

#### `logger.getMetrics(): MetricsSnapshot | null`

Returns current metrics snapshot (if metrics are enabled).

```typescript
const metrics = logger.getMetrics();
console.log(metrics.counts.total); // Total logs
console.log(metrics.throughput.current); // Current logs/sec
```

## Child Loggers

### `logger.child(context: Record<string, any>): Logger`

Creates a child logger with additional context.

```typescript
const requestLogger = logger.child({ 
  requestId: 'abc-123',
  userId: 456 
});

requestLogger.info('Processing request');
// Logs: { requestId: 'abc-123', userId: 456, msg: 'Processing request' }
```

## Context Management

### `logger.withContext<T>(context: Record<string, any>, fn: () => T): T`

Runs a function with additional context using AsyncLocalStorage.

```typescript
logger.withContext({ transactionId: 'tx-789' }, () => {
  logger.info('Starting transaction');
  processTransaction();
  logger.info('Transaction completed');
});
// All logs within the context will include transactionId
```

## Transports

### ConsoleTransport

Outputs logs to console (stdout).

```typescript
new ConsoleTransport({
  level?: LogLevel;
  pretty?: boolean;           // Pretty print format
  colors?: boolean;           // Colorize output
  timestamp?: string;         // Timestamp format
  stream?: NodeJS.WriteStream; // Output stream
})
```

### FileTransport

Writes logs to files with rotation support.

```typescript
new FileTransport({
  level?: LogLevel;
  filename: string;           // Log file path
  maxSize?: string;           // Max file size (e.g., '10MB')
  maxFiles?: number | string; // Max files to keep
  compress?: boolean;         // Compress rotated files
  bufferSize?: number;        // Write buffer size
  flushInterval?: number;     // Flush interval in ms
  datePattern?: string;       // Date pattern for rotation
  format?: 'json' | Function; // Output format
})
```

### StreamTransport

Writes logs to any Node.js writable stream.

```typescript
new StreamTransport({
  level?: LogLevel;
  stream: NodeJS.WritableStream;
  format?: 'json' | Function;
})
```

### HTTPTransport

Sends logs to HTTP endpoints with batching.

```typescript
new HTTPTransport({
  level?: LogLevel;
  url: string;                // Endpoint URL
  method?: 'POST' | 'PUT';    // HTTP method
  headers?: Record<string, string>;
  batchSize?: number;         // Logs per batch
  flushInterval?: number;     // Flush interval in ms
  timeout?: number;           // Request timeout
  retry?: {
    attempts: number;
    delay: number;
    backoff?: number;
  };
})
```

### SyslogTransport

Sends logs to syslog server.

```typescript
new SyslogTransport({
  level?: LogLevel;
  host?: string;              // Syslog host
  port?: number;              // Syslog port
  protocol?: 'udp4' | 'udp6';
  facility?: number;          // Syslog facility
  tag?: string;               // Application tag
  rfc3164?: boolean;          // Use RFC3164 format
})
```

## Formatters

### JSONFormatter

Outputs logs as JSON (default).

```typescript
new JSONFormatter()
```

### PrettyFormatter

Human-readable format with colors.

```typescript
new PrettyFormatter({
  colors?: boolean;
  timestamp?: string | boolean;
})
```

### LogfmtFormatter

Outputs in logfmt format.

```typescript
new LogfmtFormatter()
```

### CSVFormatter

Outputs in CSV format.

```typescript
new CSVFormatter({
  fields?: string[];          // Fields to include
  delimiter?: string;         // Field delimiter
  includeHeader?: boolean;    // Include CSV header
})
```

## Advanced Features

### Sampling

Reduce log volume by sampling a percentage of logs.

```typescript
const logger = hyperlog.create({
  sampling: {
    enabled: true,
    rate: 0.1,      // Sample 10% of logs
    adaptive: true  // Adjust rate based on throughput
  }
});
```

### Rate Limiting

Prevent log flooding with rate limiting.

```typescript
const logger = hyperlog.create({
  rateLimit: {
    enabled: true,
    maxPerSecond: 1000,
    maxBurst: 2000
  }
});
```

### Metrics Collection

Collect metrics about logging performance.

```typescript
const logger = hyperlog.create({
  metrics: {
    enabled: true,
    interval: 10000  // Report every 10 seconds
  }
});

// Get metrics
const metrics = logger.getMetrics();
```

Metrics include:
- Total logs by level
- Dropped logs count
- Error frequency
- Performance percentiles
- Current/average/max throughput

## Utilities

### RingBuffer

Circular buffer for efficient memory usage.

```typescript
const buffer = new RingBuffer(1024 * 1024); // 1MB buffer
buffer.write(Buffer.from('log data'));
const data = buffer.read(100);
```

### ObjectPool

Object pooling for reduced GC pressure.

```typescript
const pool = new ObjectPool(() => new LogEntry(), 100);
const entry = pool.acquire();
// Use entry...
pool.release(entry);
```

### FastJSON

Optimized JSON stringifier for log objects.

```typescript
const fastJSON = new FastJSON();
const json = fastJSON.stringify(logEntry);
```

### ErrorSerializer

Comprehensive error serialization.

```typescript
const serializer = new ErrorSerializer();
const serialized = serializer.serialize(error);
```

## Type Definitions

### LogEntry

```typescript
interface LogEntry {
  level: LogLevel;
  time: number;
  msg?: string;
  err?: Error;
  hostname?: string;
  pid?: number;
  [key: string]: any;
}
```

### Transport

```typescript
interface Transport {
  type: string;
  level?: LogLevel;
  format?: 'json' | 'pretty' | 'logfmt' | 'csv' | ((entry: LogEntry) => string);
  write(entry: LogEntry): void | Promise<void>;
  close?(): void | Promise<void>;
}
```

### Timer

```typescript
interface Timer {
  done(obj?: Record<string, any>, msg?: string): void;
}
```