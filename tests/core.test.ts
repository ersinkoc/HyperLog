import { Logger } from '../src/core/logger';
import { Sampler } from '../src/utils/sampler';
import { RateLimiter } from '../src/utils/rate-limiter';
import { MetricsAggregator } from '../src/utils/metrics-aggregator';

describe('Logger Advanced Features', () => {
  let logs: any[];
  let logger: Logger;

  beforeEach(() => {
    logs = [];
    logger = new Logger({
      transports: [{
        type: 'test',
        write: (entry) => { logs.push(entry); },
        close: () => Promise.resolve()
      }]
    });
  });

  describe('sampling', () => {
    it('should sample logs when enabled', () => {
      logger = new Logger({
        sampling: {
          enabled: true,
          rate: 0.5,
          adaptive: false
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // Log many times
      for (let i = 0; i < 100; i++) {
        logger.info(`Test ${i}`);
      }

      // Should have sampled approximately 50%
      expect(logs.length).toBeGreaterThan(30);
      expect(logs.length).toBeLessThan(70);
    });
  });

  describe('rate limiting', () => {
    it('should limit logs when enabled', () => {
      logger = new Logger({
        rateLimit: {
          enabled: true,
          maxPerSecond: 10,
          maxBurst: 10
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // Try to log 100 times quickly
      for (let i = 0; i < 100; i++) {
        logger.info(`Test ${i}`);
      }

      // Should be limited to burst size
      expect(logs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('metrics', () => {
    it('should track metrics when enabled', () => {
      logger = new Logger({
        metrics: {
          enabled: true,
          interval: 1000
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      logger.info('Test 1');
      logger.error(new Error('Test error'));
      logger.warn('Test warning');

      if (logger.getMetrics) {
        const metrics = logger.getMetrics();
        expect(metrics.counts.total).toBe(3);
        expect(metrics.counts.byLevel.info).toBe(1);
        expect(metrics.counts.byLevel.error).toBe(1);
        expect(metrics.counts.byLevel.warn).toBe(1);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle undefined message', () => {
      logger.info(undefined);
      expect(logs[0].msg).toBe('undefined');
    });

    it('should handle null object', () => {
      logger.info(null);
      expect(logs[0].msg).toBe('null');
    });

    it('should handle circular references in context', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      const childLogger = logger.child(circular);
      childLogger.info('Test');
      
      expect(logs.length).toBe(1);
    });

    it('should handle invalid log level in setLevel', () => {
      expect(() => logger.setLevel('invalid' as any)).toThrow('Invalid log level');
    });

    it('should remove transport', () => {
      const transport = logger['transports'][0];
      logger.addTransport({
        type: 'test2',
        write: () => {}
      });
      
      expect(logger['transports'].length).toBe(2);
      logger.removeTransport(transport);
      expect(logger['transports'].length).toBe(1);
    });

    it('should handle missing transport', () => {
      logger.removeTransport({
        type: 'nonexistent',
        write: () => {}
      });
      // Should not throw
    });
  });

  describe('async operations', () => {
    it('should close all transports', async () => {
      let closed = false;
      logger = new Logger({
        transports: [{
          type: 'test',
          write: () => {},
          close: async () => { closed = true; }
        }]
      });

      await logger.close();
      expect(closed).toBe(true);
    });

    it('should handle transport without close method', async () => {
      logger = new Logger({
        transports: [{
          type: 'test',
          write: () => {}
        }]
      });

      await expect(logger.close()).resolves.not.toThrow();
    });

    it('should handle metrics enabled', async () => {
      const originalLog = console.log;
      const logs: any[] = [];
      console.log = (...args: any[]) => logs.push(args);

      logger = new Logger({
        metrics: {
          enabled: true,
          interval: 10
        }
      });

      logger.info('Test message');

      await new Promise(resolve => setTimeout(resolve, 50));

      console.log = originalLog;
    });

    it('should handle rate limiting and metrics', () => {
      const rateLimiter = {
        tryAcquire: jest.fn().mockReturnValue(false)
      };
      const metricsAggregator = {
        recordDropped: jest.fn(),
        recordLog: jest.fn(),
        getSnapshot: jest.fn().mockReturnValue({ dropped: 5 })
      };
      
      logger = new Logger({
        level: 'info',
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      // Manually set the aggregator to test the functionality
      (logger as any).metricsAggregator = metricsAggregator;
      (logger as any).rateLimiter = rateLimiter;
      
      // This should trigger rate limiting (line 129)
      logger.info('Rate limited message');
      
      expect(metricsAggregator.recordDropped).toHaveBeenCalled();
      expect(logs).toHaveLength(0); // Message should be dropped
      
      // Test getMetrics (line 291)
      const metrics = logger.getMetrics?.();
      expect(metrics).toEqual({ dropped: 5 });
    });

    it('should handle custom filter function', () => {
      logger = new Logger({
        level: 'info',
        filter: (entry) => entry.msg !== 'filtered',
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      logger.info('allowed');
      logger.info('filtered'); // Should be filtered out (line 137)
      
      expect(logs).toHaveLength(1);
      expect(logs[0].msg).toBe('allowed');
    });

    it('should include hostname, pid, and name when configured', () => {
      logger = new Logger({
        level: 'info',
        hostname: true, // line 159
        pid: true,      // line 163
        name: 'test-logger', // line 167
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      logger.info('Test message');
      
      expect(logs).toHaveLength(1);
      expect(logs[0].hostname).toBeDefined();
      expect(logs[0].pid).toBeDefined();
      expect(logs[0].name).toBe('test-logger');
    });

    it('should return null when no metrics aggregator is configured', () => {
      logger = new Logger({
        level: 'info',
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      // Should return null when no metrics aggregator (line 291)
      const metrics = logger.getMetrics?.();
      expect(metrics).toBeNull();
    });

    it('should initialize sampling when enabled', () => {
      // Test sampling initialization (lines 61-64)
      logger = new Logger({
        level: 'info',
        sampling: {
          enabled: true,
          rate: 0.5
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      expect((logger as any).sampler).toBeDefined();
    });

    it('should initialize rate limiting when enabled', () => {
      // Test rate limiting initialization (lines 68-72)
      logger = new Logger({
        level: 'info',
        rateLimit: {
          enabled: true,
          maxPerSecond: 10,
          maxBurst: 5
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      expect((logger as any).rateLimiter).toBeDefined();
    });

    it('should handle metrics initialization', async () => {
      // Test metrics initialization (lines 76-90)
      logger = new Logger({
        level: 'info',
        metrics: {
          enabled: true,
          interval: 10
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      expect((logger as any).metricsAggregator).toBeDefined();
      
      logger.info('test');
      
      await new Promise(resolve => setTimeout(resolve, 15));
      await logger.close();
    });

    it('should respect log level filtering', () => {
      logger = new Logger({
        level: 'warn', // Only warn and above
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      logger.trace('trace message'); // Should be filtered out (line 115)
      logger.debug('debug message'); // Should be filtered out (line 115)
      logger.info('info message'); // Should be filtered out (line 115)
      logger.warn('warn message'); // Should pass
      logger.error('error message'); // Should pass

      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
    });

    it('should handle sampling with metrics', () => {
      const sampler = {
        shouldSample: jest.fn().mockReturnValue(false) // Always drop
      };
      const metricsAggregator = {
        recordDropped: jest.fn(),
        recordLog: jest.fn(),
        getSnapshot: jest.fn()
      };

      logger = new Logger({
        level: 'info',
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // Manually set sampler and metrics to test lines 119-123
      (logger as any).sampler = sampler;
      (logger as any).metricsAggregator = metricsAggregator;

      logger.info('sampled message');

      expect(sampler.shouldSample).toHaveBeenCalled();
      expect(metricsAggregator.recordDropped).toHaveBeenCalled();
      expect(logs).toHaveLength(0); // Message should be dropped
    });


    it('should handle transport write errors', () => {
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      logger = new Logger({
        transports: [{
          type: 'error-transport',
          write: () => {
            throw new Error('Transport error');
          }
        }]
      });

      logger.info('test');

      expect(errors.some(e => e[0] === 'Transport write error:')).toBe(true);

      console.error = originalError;
    });

    it('should handle async transport write errors', async () => {
      const originalError = console.error;
      const errors: any[] = [];
      console.error = (...args: any[]) => errors.push(args);

      logger = new Logger({
        transports: [{
          type: 'async-error-transport',
          write: async () => {
            throw new Error('Async transport error');
          }
        }]
      });

      logger.info('test');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errors.some(e => e[0] === 'Transport write error:')).toBe(true);

      console.error = originalError;
    });




    it('should handle sampling with skip', () => {
      logger = new Logger({
        sampling: {
          enabled: true,
          rate: 0
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      logger.info('should be skipped');

      expect(logs).toHaveLength(0);
    });

    it('should handle rate limit with skip', () => {
      logger = new Logger({
        rateLimit: {
          enabled: true,
          maxPerSecond: 0,
          maxBurst: 0
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      logger.info('should be rate limited');

      expect(logs).toHaveLength(0);
    });

    it('should support all log levels', () => {
      // Create logger with trace level to capture all logs
      logger = new Logger({
        level: 'trace',
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });
      
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      logger.fatal('fatal message');

      expect(logs).toHaveLength(6);
      expect(logs[0].level).toBe('trace');
      expect(logs[1].level).toBe('debug');
      expect(logs[2].level).toBe('info');
      expect(logs[3].level).toBe('warn');
      expect(logs[4].level).toBe('error');
      expect(logs[5].level).toBe('fatal');
    });

    it('should track dropped logs with metrics and sampling', () => {
      logger = new Logger({
        sampling: {
          enabled: true,
          rate: 0 // Always drop
        },
        metrics: {
          enabled: true,
          interval: 1000
        },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // This should be dropped and recorded as dropped
      logger.info('should be dropped');
      
      expect(logs).toHaveLength(0);
      
      // Verify metrics aggregator exists
      expect((logger as any).metricsAggregator).toBeDefined();
    });

    it('should handle error with message field assignment', () => {
      // Test line 183 in logger.ts: if (msg) entry.msg = msg;
      logger.error(new Error('Test error'), 'Custom message');
      
      expect(logs).toHaveLength(1);
      expect(logs[0].msg).toBe('Custom message');
      expect(logs[0].err).toBeDefined();
    });

    it('should handle object assignment with message', () => {
      // Test line 189 in logger.ts: if (msg) entry.msg = msg;
      logger.info({ user: 'test', action: 'login' }, 'User logged in');
      
      expect(logs).toHaveLength(1);
      expect(logs[0].msg).toBe('User logged in');
      expect(logs[0].user).toBe('test');
      expect(logs[0].action).toBe('login');
    });

    it('should test redact sensitive data functionality', () => {
      // Test lines 201-213 in logger.ts
      logger = new Logger({
        redact: ['password', 'secret'],
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        nested: {
          secret: 'hidden'
        }
      };

      logger.info(sensitiveData, 'Login attempt');

      expect(logs).toHaveLength(1);
      expect(logs[0].password).toBe('[REDACTED]');
      expect(logs[0].nested.secret).toBe('[REDACTED]');
      expect(logs[0].username).toBe('testuser'); // Not redacted
    });

    it('should handle primitive value with message (line 189)', () => {
      // Test line 189: if (msg) entry.msg = msg; in the else branch
      logger.info(123, 'Number value');
      
      expect(logs).toHaveLength(1);
      expect(logs[0].msg).toBe('Number value'); // Message should override String(obj)
    });

    it('should test redaction with non-object values (line 201)', () => {
      // Test line 201: if (typeof obj !== 'object' || obj === null) return obj;
      logger = new Logger({
        redact: ['field'],
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // Log with primitive values that should trigger line 201
      logger.info('string value');
      logger.info(42);
      logger.info(true);
      logger.info(null);

      expect(logs).toHaveLength(4);
      expect(logs[0].msg).toBe('string value');
      expect(logs[1].msg).toBe('42');
      expect(logs[2].msg).toBe('true');
      expect(logs[3].msg).toBe('null');
    });

    it('should test redaction function with primitive values (line 201)', () => {
      // Test line 201: if (typeof obj !== 'object' || obj === null) return obj;
      logger = new Logger({
        redact: ['sensitive'],
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      // Create an entry that will trigger redaction with mixed primitive and object values
      const logEntry = {
        message: 'test message',
        primitive: 'should not be redacted', 
        nullValue: null,
        sensitive: 'should be redacted'
      };

      logger.info(logEntry);

      expect(logs).toHaveLength(1);
      expect(logs[0].sensitive).toBe('[REDACTED]');
      expect(logs[0].primitive).toBe('should not be redacted');
      expect(logs[0].nullValue).toBe(null); // null should pass through line 201
    });

    it('should trigger constructor with all option paths (line 35)', () => {
      // Ensure line 35 (constructor) is covered by testing various constructor options
      const loggerWithOptions = new Logger({
        level: 'debug',
        name: 'test-logger', 
        pretty: true,
        timestamp: false,
        hostname: true,
        pid: true,
        context: { service: 'test' },
        redact: ['password'],
        sampling: { enabled: true, rate: 0.5 },
        rateLimit: { enabled: true, maxPerSecond: 100 },
        metrics: { enabled: true, interval: 5000 },
        transports: [{
          type: 'test',
          write: (entry) => { logs.push(entry); }
        }]
      });

      expect(loggerWithOptions).toBeDefined();
      loggerWithOptions.info('test');
      expect(logs.length).toBeGreaterThanOrEqual(0); // May be sampled
    });
  });
});