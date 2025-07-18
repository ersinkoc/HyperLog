import { Logger } from './core/logger';
import { LoggerOptions } from './core/types';

// Core exports
export { Logger } from './core/logger';
export * from './core/types';
export * from './core/levels';

// Transport exports
export { ConsoleTransport } from './transports/console';
export { FileTransport } from './transports/file';
export { StreamTransport } from './transports/stream';
export { HTTPTransport } from './transports/http';
export { SyslogTransport, SYSLOG_FACILITY } from './transports/syslog';

// Formatter exports
export { JSONFormatter } from './formatters/json';
export { PrettyFormatter } from './formatters/pretty';
export { LogfmtFormatter } from './formatters/logfmt';
export { CSVFormatter } from './formatters/csv';

// Utility exports
export { SafeStringify } from './utils/safe-stringify';
export { ErrorSerializer } from './utils/error-serializer';
export { RingBuffer } from './utils/ring-buffer';
export { ObjectPool, PoolableLogEntry } from './utils/object-pool';
export { FastJSON } from './utils/fast-json';
export { AsyncWriteQueue } from './utils/async-write-queue';
export { Sampler, AdaptiveSampler } from './utils/sampler';
export { RateLimiter, SlidingWindowRateLimiter } from './utils/rate-limiter';
export { MetricsAggregator } from './utils/metrics-aggregator';

// Rotation exports
export { FileRotator } from './rotation/file-rotator';

// Middleware exports
export { expressLogger, fastifyLogger } from './middleware';

/**
 * Creates a new HyperLog logger instance with the specified options.
 * 
 * @param options - Logger configuration options
 * @returns A new Logger instance
 * 
 * @example
 * ```typescript
 * const logger = hyperlog.create({
 *   level: 'info',
 *   pretty: true,
 *   transports: [
 *     new ConsoleTransport(),
 *     new FileTransport({ filename: 'app.log' })
 *   ]
 * });
 * ```
 */
export function create(options?: LoggerOptions): Logger {
  return new Logger(options);
}

// Default export
const hyperlog = {
  create,
  Logger
};

export default hyperlog;