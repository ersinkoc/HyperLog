import { AsyncLocalStorage } from 'async_hooks';
import { hostname } from 'os';
import { LogLevel, LogEntry, LoggerOptions, Transport, Timer } from './types';
import { shouldLog, isValidLevel } from './levels';
import { ConsoleTransport } from '../transports/console';
import { SafeStringify } from '../utils/safe-stringify';
import { ErrorSerializer } from '../utils/error-serializer';
import { Sampler } from '../utils/sampler';
import { RateLimiter } from '../utils/rate-limiter';
import { MetricsAggregator } from '../utils/metrics-aggregator';

/**
 * High-performance logger with support for child loggers, context propagation,
 * and multiple transports.
 * 
 * @example
 * ```typescript
 * const logger = new Logger({ level: 'info', pretty: true });
 * logger.info({ userId: 123 }, 'User logged in');
 * ```
 */
export class Logger {
  private options: Required<LoggerOptions>;
  private transports: Transport[];
  private contextStorage: AsyncLocalStorage<Record<string, any>>;
  private safeStringify: SafeStringify;
  private errorSerializer: ErrorSerializer;
  private _hostname: string;
  private _pid: number;
  private sampler?: Sampler;
  private rateLimiter?: RateLimiter;
  private metricsAggregator?: MetricsAggregator;
  private metricsInterval?: NodeJS.Timeout;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level || 'info',
      name: options.name || '',
      pretty: options.pretty ?? process.env.NODE_ENV === 'development',
      timestamp: options.timestamp ?? true,
      hostname: options.hostname ?? false,
      pid: options.pid ?? false,
      transports: options.transports || [new ConsoleTransport({ pretty: options.pretty })],
      context: options.context || {},
      redact: options.redact || [],
      filter: options.filter || (() => true),
      sampling: options.sampling || { enabled: false, rate: 1, adaptive: false },
      rateLimit: options.rateLimit || { enabled: false, maxPerSecond: 10000 },
      metrics: options.metrics || { enabled: false, interval: 60000 }
    };

    this.transports = this.options.transports;
    this.contextStorage = new AsyncLocalStorage();
    this.safeStringify = new SafeStringify();
    this.errorSerializer = new ErrorSerializer();
    this._hostname = hostname();
    this._pid = process.pid;

    // Initialize sampling
    if (this.options.sampling.enabled) {
      this.sampler = new Sampler({ 
        rate: this.options.sampling.rate
      });
    }

    // Initialize rate limiting
    if (this.options.rateLimit.enabled) {
      this.rateLimiter = new RateLimiter({
        maxPerSecond: this.options.rateLimit.maxPerSecond,
        maxBurst: this.options.rateLimit.maxBurst
      });
    }

    // Initialize metrics
    if (this.options.metrics.enabled) {
      this.metricsAggregator = new MetricsAggregator();
      this.metricsInterval = setInterval(() => {
        const metrics = this.metricsAggregator!.getSnapshot();
        console.log('Metrics:', metrics);
      }, this.options.metrics.interval);
      
      // Ensure timer doesn't keep process alive in tests
      if (this.metricsInterval.unref) {
        this.metricsInterval.unref();
      }
    }
  }

  trace(obj: any, msg?: string): void {
    this.log('trace', obj, msg);
  }

  debug(obj: any, msg?: string): void {
    this.log('debug', obj, msg);
  }

  info(obj: any, msg?: string): void {
    this.log('info', obj, msg);
  }

  warn(obj: any, msg?: string): void {
    this.log('warn', obj, msg);
  }

  error(obj: any, msg?: string): void {
    this.log('error', obj, msg);
  }

  fatal(obj: any, msg?: string): void {
    this.log('fatal', obj, msg);
  }

  private log(level: LogLevel, obj: any, msg?: string): void {
    if (!shouldLog(level, this.options.level)) {
      return;
    }

    // Check sampling
    if (this.sampler && !this.sampler.shouldSample()) {
      if (this.metricsAggregator) {
        this.metricsAggregator.recordDropped();
      }
      return;
    }

    // Check rate limiting
    if (this.rateLimiter && !this.rateLimiter.tryAcquire()) {
      if (this.metricsAggregator) {
        this.metricsAggregator.recordDropped();
      }
      return;
    }

    const entry = this.createLogEntry(level, obj, msg);
    
    if (!this.options.filter(entry)) {
      return;
    }

    // Record metrics
    if (this.metricsAggregator) {
      this.metricsAggregator.recordLog(entry);
    }

    this.write(entry);
  }

  private createLogEntry(level: LogLevel, obj: any, msg?: string): LogEntry {
    const entry: LogEntry = {
      level,
      time: Date.now()
    };

    if (this.options.timestamp) {
      entry.time = Date.now();
    }

    if (this.options.hostname) {
      entry.hostname = this._hostname;
    }

    if (this.options.pid) {
      entry.pid = this._pid;
    }

    if (this.options.name) {
      entry.name = this.options.name;
    }

    const context = this.contextStorage.getStore();
    if (context) {
      Object.assign(entry, context);
    }

    if (this.options.context) {
      Object.assign(entry, this.options.context);
    }

    if (typeof obj === 'string' && msg === undefined) {
      entry.msg = obj;
    } else if (obj instanceof Error) {
      entry.err = this.errorSerializer.serialize(obj);
      if (msg) entry.msg = msg;
    } else if (typeof obj === 'object' && obj !== null) {
      Object.assign(entry, obj);
      if (msg) entry.msg = msg;
    } else {
      entry.msg = String(obj);
      if (msg) entry.msg = msg;
    }

    this.redactSensitive(entry);

    return entry;
  }

  private redactSensitive(entry: LogEntry): void {
    if (this.options.redact.length === 0) return;

    const redact = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const key in obj) {
        if (this.options.redact.includes(key)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          obj[key] = redact(obj[key]);
        }
      }
      return obj;
    };

    redact(entry);
  }

  private write(entry: LogEntry): void {
    for (const transport of this.transports) {
      if (shouldLog(entry.level, transport.level || this.options.level)) {
        try {
          const result = transport.write(entry);
          if (result instanceof Promise) {
            result.catch(err => {
              console.error('Transport write error:', err);
            });
          }
        } catch (err) {
          console.error('Transport write error:', err);
        }
      }
    }
  }

  child(context: Record<string, any>): Logger {
    const childOptions = {
      ...this.options,
      context: { ...this.options.context, ...context },
      transports: this.transports
    };
    return new Logger(childOptions);
  }

  withContext<T>(context: Record<string, any>, fn: () => T): T {
    return this.contextStorage.run(context, fn);
  }

  startTimer(): Timer {
    const start = Date.now();
    return {
      done: (obj?: Record<string, any>, msg?: string) => {
        const duration = Date.now() - start;
        const data = { ...obj, duration };
        this.info(data, msg);
      }
    };
  }

  setLevel(level: LogLevel): void {
    if (!isValidLevel(level)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.options.level = level;
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  removeTransport(transport: Transport): void {
    const index = this.transports.indexOf(transport);
    if (index !== -1) {
      this.transports.splice(index, 1);
    }
  }

  async close(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    await Promise.all(
      this.transports.map(transport => 
        transport.close ? transport.close() : Promise.resolve()
      )
    );
  }

  getMetrics?(): any {
    if (this.metricsAggregator) {
      return this.metricsAggregator.getSnapshot();
    }
    return null;
  }
}